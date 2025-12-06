import { api } from "./api";

export const getActiveMaintenanceSchedules = async () => {
    const response = await api.get("/api/maintenance/schedules/active");
    return response.data; // Returns { data: [...], ... } usually, or just data depending on interceptor
};

export const getPriorityMaintenanceSchedules = async () => {
    const response = await api.get("/api/maintenance/schedules/priority");
    return response.data;
};

export const getInactiveMaintenanceSchedules = async () => {
    const response = await api.get("/api/maintenance/schedules/inactive");
    return response.data;
};

export const getMaintenanceScheduleById = async (id) => {
    const response = await api.get(`/api/maintenance/schedules/${id}`);
    return response.data;
};

export const updateMaintenanceStatus = async (id, status, files = []) => {
    const formData = new FormData();
    formData.append('status', status);
    files.forEach((file) => {
        formData.append('files', file);
    });
    const response = await api.patch(`/api/maintenance/schedules/${id}/status`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
};
