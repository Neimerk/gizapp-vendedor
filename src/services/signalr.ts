import * as signalR from "@microsoft/signalr";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5003";

function getToken() {
  const raw = localStorage.getItem("gizapp-seller-auth");

  if (!raw) return "";

  try {
    return JSON.parse(raw)?.token || "";
  } catch {
    return "";
  }
}

export const ordersConnection = new signalR.HubConnectionBuilder()
  .withUrl(`${API_URL}/hubs/orders`, {
    accessTokenFactory: getToken,
  })
  .withAutomaticReconnect()
  .build();

export async function startOrdersConnection() {
  if (ordersConnection.state === signalR.HubConnectionState.Disconnected) {
    await ordersConnection.start();
  }
}