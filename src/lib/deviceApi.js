
import { api } from "./api";

/** GET /api/devices/{id} – Lấy chi tiết thiết bị */
export async function getDeviceDetail(deviceId) {
    const { data } = await api.get(`/api/devices/${Number(deviceId)}`);
    return data?.data ?? data ?? null;
}

/** GET /api/conditions/definitions – Lấy danh sách định nghĩa tình trạng
 *  params: { deviceModelId }
 */
export async function getConditionDefinitions(deviceModelId) {
    const params = {};
    if (deviceModelId) {
        params.deviceModelId = Number(deviceModelId);
    }
    const { data } = await api.get("/api/conditions/definitions", { params });
    return data?.data ?? data ?? [];
}
