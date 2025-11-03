import React from "react";
import Lottie from "lottie-react";
import { Empty } from "antd";

export default function AnimatedEmpty({ description = "Không có dữ liệu", animationUrl = "https://assets9.lottiefiles.com/private_files/lf30_editor_tifnq2.json", width = 240, style }) {
  const [data, setData] = React.useState(null);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch(animationUrl);
        if (mounted && res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch {
        // ignore
      }
    })();
    return () => { mounted = false; };
  }, [animationUrl]);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", ...style }}>
      {data ? (
        <div style={{ width, opacity: 0.95 }}>
          <Lottie animationData={data} loop autoplay style={{ width: "100%", height: "100%" }} />
        </div>
      ) : null}
      <div style={{ marginTop: 8 }}>
        <Empty description={description} />
      </div>
    </div>
  );
}


