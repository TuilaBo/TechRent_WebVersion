// /src/utils/kycOcrFE.js
import dayjs from "dayjs";

/** ============== OCR (FE only) ============== **/
async function ocr(fileOrUrl, langs = "vie+eng") {
  const T = await import("tesseract.js");
  // Cấu hình nhận dạng ưu tiên tiếng Việt có dấu, hạn chế ký tự rác
  // Lưu ý: tesseract.js cho phép truyền config qua tham số thứ 3 của recognize
  // Không truyền logger để tránh DataCloneError trong web worker của một số trình duyệt
  const VI_WHITELIST =
    // Chữ cái Latinh có dấu tiếng Việt (hoa + thường) + khoảng trắng + số và vài dấu cho ngày/tháng
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ" +
    "abcdefghijklmnopqrstuvwxyz" +
    "ÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚĂĐĨŨƠƯàáâãèéêìíòóôõùúăđĩũơư" +
    "ẠẢÃÀÁÂẦẨẪẤĂẰẲẴẮẸẺẼỀỂỄẾÌÍĨỈỊỌỎÒÓÔỒỔỖỐƠỜỞỠỚỤỦŨÙÚƯỪỬỮỨ" +
    "ạảãàáâầẩẫấăằẳẵắẹẻẽềểễếìíĩỉịọỏòóôồổỗốơờởỡớụủũùúưừửữứ" +
    "ỲỴỶÝỳỵỷý" +
    " -/0123456789";
  const { data } = await T.recognize(fileOrUrl, langs, {
    // PSM 6: Assume a single uniform block of text
    tessedit_pageseg_mode: 6,
    // LSTM only for better accuracy on diacritics
    tessedit_oem_mode: 1,
    // Giữ khoảng trắng giữa các từ ổn định hơn
    preserve_interword_spaces: "1",
    // DPI cao giúp tăng độ chính xác với ảnh chụp
    user_defined_dpi: "300",
    // Hạn chế ký tự rác thường gặp khi chụp nghiêng/ánh sáng kém
    tessedit_char_whitelist: VI_WHITELIST,
  });
  return (data?.text || "").replace(/\r/g, "");
}

/** ============== Helpers chung ============== **/
function norm(s = "") {
  return s
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

const DATE_RE = /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/g;

function toISO(dstr) {
  if (!dstr) return "";
  const [d, m, yRaw] = dstr.replace(/-/g, "/").split("/");
  const y = (yRaw || "").length === 2 ? `20${yRaw}` : yRaw;
  const iso = dayjs(
    `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`
  );
  return iso.isValid() ? iso.format("YYYY-MM-DD") : "";
}

/** ============== Số định danh ============== **/
function pickIdNumber(text) {
  const withHint = text.match(/(Số|So|SỐ|ID|No\.?)\s*[:\-]?\s*([0-9]{9,12})/);
  if (withHint?.[2]) return withHint[2];

  const mrz = (text.match(/\b\d{12}\b/g) || [])[0];
  if (mrz) return mrz;

  const nums = text.match(/\b\d{9}\b|\b\d{12}\b/g);
  if (!nums) return "";
  return nums.find((n) => n.length === 12) || nums[0];
}

/** ============== Họ tên ============== **/
// Làm sạch họ tên: bỏ token 1 ký tự (lỗi OCR từ < thành chữ rời), rút gọn khoảng trắng
function cleanFullName(name = "") {
  return name
    .split(/\s+/)
    .filter((t) => t.length > 1) // loại “K”, “I”, …
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function nameFromMRZ(backText = "") {
  const mrzLine = backText
    .split("\n")
    .map((l) => l.replace(/\s+/g, ""))
    .find((l) => /^[A-Z<]{6,}$/.test(l) && l.includes("<<"));
  if (!mrzLine) return "";
  // LE<<HOANG<TRONG<<<< -> LE HOANG TRONG
  const raw = mrzLine.replace(/<+/g, " ").replace(/\s+/g, " ").trim();
  return cleanFullName(raw);
}

function nameFromFront(frontText = "") {
  const lines = frontText.split("\n");
  const idx = lines.findIndex((l) => /Họ\s*và\s*tên|Full\s*name/i.test(l));
  if (idx >= 0) {
    const onSame = lines[idx].replace(/.*(Họ\s*và\s*tên|Full\s*name)\s*[:\-]?\s*/i, "").trim();
    const next = lines[idx + 1]?.trim() || "";
    const cand = [onSame, next]
      .map((x) => x.replace(/[^\p{L}\s]/gu, "").trim())
      .filter(Boolean)
      .sort((a, b) => b.length - a.length)[0];
    if (cand) return cleanFullName(cand);
  }
  // Cho phép toàn bộ ký tự chữ Unicode có dấu (hoa/thường) và khoảng trắng
  const big = lines.find((l) => {
    const onlyLetters = /^[\p{L}\s]{6,}$/u.test(l);
    const isHeader =
      /CỘNG HÒA|CHỨNG MINH|CĂN CƯỚC|VIỆT NAM|SPECIMEN|BẢN MẪU/i.test(l);
    return onlyLetters && !isHeader;
  });
  return big ? cleanFullName(big) : "";
}

function pickFullName(frontText, backText) {
  return nameFromMRZ(backText) || nameFromFront(frontText) || "";
}

/** ============== Ngày sinh & Ngày cấp ============== **/
function pickDob(frontText, backText, merged) {
  const search = (txt) => {
    const line = txt.split("\n").find((l) => /(Ngày\s*sinh|Date\s*of\s*birth)/i.test(l));
    const m = line?.match(DATE_RE);
    return m?.[0] || "";
  };
  const direct = search(frontText) || search(backText);
  if (direct) return direct;

  // fallback: ngày nhỏ nhất trong toàn văn (DOB thường là năm nhỏ nhất)
  const uniq = Array.from(new Set(merged.match(DATE_RE) || []));
  return (
    uniq
      .map((d) => ({ raw: d, y: parseInt(d.split(/[\/\-]/)[2], 10) || 9999 }))
      .sort((a, b) => a.y - b.y)[0]?.raw || ""
  );
}

function pickIssue(frontText, backText, merged) {
  // 1) ƯU TIÊN “Date, month, year” — tìm ngày sau cụm nhãn (có thể ở cùng/vị trí ngay sau)
  const idx = backText.search(/Date[, ]*month[, ]*year|Ngày[, ]*tháng[, ]*năm/i);
  if (idx >= 0) {
    const after = backText.slice(idx, idx + 200); // vùng ngay sau nhãn
    const m = after.match(DATE_RE);
    if (m?.[0]) return m[0];
    // nếu cùng dòng không có, thử 2 dòng kế
    const tail = backText.slice(idx).split("\n").slice(0, 3).join(" ");
    const m2 = tail.match(DATE_RE);
    if (m2?.[0]) return m2[0];
  }

  // 2) Thử các nhãn “Ngày cấp / Date of issue” trên cả 2 mặt
  const search = (txt) => {
    const line = txt.split("\n").find((l) => /(Ngày\s*cấp|Date\s*of\s*issue)/i.test(l));
    return line?.match(DATE_RE)?.[0] || "";
  };
  const viaLabel = search(frontText) || search(backText);
  if (viaLabel) return viaLabel;

  // 3) Cuối cùng: chọn ngày LỚN NHẤT (KHÔNG phải expiry) — tránh nhầm DOB
  const expiryLine =
    merged.split("\n").find((l) => /(Có giá trị đến|Date of expiry|Hết hạn)/i.test(l)) || "";
  const expiry = expiryLine.match(DATE_RE)?.[0];

  const uniq = Array.from(new Set(merged.match(DATE_RE) || []));
  const filtered = uniq.filter((d) => d !== expiry);
  const list = (filtered.length ? filtered : uniq)
    .map((d) => ({ raw: d, y: parseInt(d.split(/[\/\-]/)[2], 10) || 0 }))
    .sort((a, b) => b.y - a.y);

  const dobRaw = pickDob(frontText, backText, merged);
  if (list[0]?.raw === dobRaw && list[1]) return list[1].raw;
  return list[0]?.raw || "";
}

/** ============== Địa chỉ (Place of residence) ============== **/
function cleanAddressPhrase(s = "") {
    // bỏ tiêu đề + ngày + những rác OCR hay gặp
    let out = s
      .replace(/.*(Nơi thường trú|Địa chỉ|Place of residence)\s*[:\-]?\s*/i, "")
      .replace(/(Có giá trị.*$)/i, "")
      .replace(DATE_RE, "")
      .replace(/\b(Data|oatb[rp]i[y|j]|oatbpiy|co|có|giác|đầm)\b/gi, "")
      .replace(/\s{2,}/g, " ")
      .trim();
  
    // 1) Bắt cụm "số nhà (+/số) ... Đường/ Duong + số"
    //    Cho phép có chữ rác xen giữa số nhà và chữ "Đường"
    const houseStreetRe =
      /(?:Số\s*)?(\d{1,5}(?:\/\d{1,5})?)\s*(?:[A-Za-zÀ-ỹ\.\-«»<> ]{0,10})?(Đ(?:ườ|u)o?ng|Duong|Đg|Đ\.)\s*(\d{1,4})/i;
    const hs = out.match(houseStreetRe);
  
    // 2) Bắt cụm địa danh (phường/xã, quận/huyện, tỉnh/thành) phía sau
    const localityRe =
      /(Phước Long\s*[AB]|Phuoc Long\s*[AB])[^,]*,\s*TP\.?\s*Thủ Đức[^,]*,\s*(?:TP\.?\s*HCM|TP\.?\s*Hồ Chí Minh|HCM)/i;
    const locality = out.match(localityRe);
  
    if (hs) {
      const house = `${hs[1]} Đường ${hs[3]}`; // chuẩn hoá thành "35/6 Đường 185"
      if (locality) {
        return `${house}, ${locality[0].replace(/\s+,/g, ",").replace(/,\s+/g, ", ").trim()}`;
      }
      // nếu chưa bắt được locality, trả luôn từ vị trí house tới hết chuỗi
      const idx = out.toLowerCase().indexOf(hs[0].toLowerCase());
      out = out.slice(idx);
    }
  
    // Chuẩn hoá dấu phẩy/khoảng trắng
    return out.replace(/[,\.]\s*[,\.]/g, ",").replace(/\s+,/g, ",").replace(/,\s+/g, ", ").trim();
  }
  
  function pickAddress(frontText, backText) {
    const takeAround = (txt) => {
      const arr = txt.split("\n");
      const i = arr.findIndex((l) => /(Nơi thường trú|Địa chỉ|Place of residence)/i.test(l));
      if (i < 0) return "";
      // lấy rộng hơn: dòng nhãn + 3–4 dòng kế tiếp để không mất “35/6 …”
      const bloc = [arr[i], arr[i + 1], arr[i + 2], arr[i + 3], arr[i + 4]]
        .filter(Boolean)
        .join(" ");
      return cleanAddressPhrase(bloc);
    };
  
    // Ưu tiên mặt trước rồi tới mặt sau; nếu vẫn rỗng thì fallback theo dòng dài
    let res = takeAround(frontText) || takeAround(backText);
    if (!res) {
      const longLine = (frontText + "\n" + backText)
        .split("\n")
        .filter((l) => l.length > 20)
        .sort((a, b) => b.length - a.length)[0];
      res = longLine ? cleanAddressPhrase(longLine) : "";
    }
    return res;
  }

/** ============== Loại giấy tờ ============== **/
function inferIdType(idNumber) {
  if (!idNumber) return "CMND";
  return idNumber.length >= 12 ? "CCCD" : "CMND";
}

/** ============== PUBLIC API ============== **/
export async function extractIdFieldsFE(frontFile, backFile) {
  const [frontRaw, backRaw] = await Promise.all([
    frontFile ? ocr(frontFile, "vie+eng") : Promise.resolve(""),
    backFile ? ocr(backFile, "vie+eng") : Promise.resolve(""),
  ]);

  const front = norm(frontRaw);
  const back = norm(backRaw);
  const merged = norm([front, back].filter(Boolean).join("\n"));

  const idNumber = pickIdNumber(merged);
  const fullName = pickFullName(front, back);
  const dobISO = toISO(pickDob(front, back, merged));
  const issueISO = toISO(pickIssue(front, back, merged));
  const address = pickAddress(front, back);
  const idType = inferIdType(idNumber);

  return {
    fullName,
    idNumber,
    idType,
    dobISO,
    issueDateISO: issueISO,
    address,
    // debugFront: front, debugBack: back, debugMerged: merged,
  };
}
