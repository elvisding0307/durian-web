import axios from "axios";
import { API_BASE_URL } from "../config/url";
import { getTokenFromCookie } from "../utils/auth";

export async function requestPing(): Promise<boolean> {
  try {
    // 创建axios实例
    const apiClient = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        "Content-Type": "application/json",
        Authorization: (await getTokenFromCookie()) ?? "",
      },
    });

    const response = await apiClient.get("/ping", {});
    const status = response.status;
    if (status === 200) {
      return true;
    }
  } catch (e: any) {
    return false;
  }
  return false;
}
