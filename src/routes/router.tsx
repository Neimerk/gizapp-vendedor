import { redirect, createBrowserRouter } from "react-router-dom";

import DashboardLayout from "../layouts/DashboardLayout";
import DashboardPage from "../pages/DashboardPage";
import ProductsPage from "../pages/ProductsPage";
import StoreSettingsPage from "../pages/StoreSettingsPage";
import OrdersPage from "../pages/OrdersPage";
import CourierPage from "../pages/CourierPage";
import LoginPage from "../pages/LoginPage";
import RegisterPage from "../pages/RegisterPage";

import { getAuth } from "../services/auth";

function protectedLoader() {
  const auth = getAuth();
  if (!auth) throw redirect("/login");
  const allowed = ["Seller", "Admin", "Courier"];
  if (!allowed.includes(auth.role)) throw redirect("/login");
  return null;
}

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/cadastro",
    element: <RegisterPage />,
  },
  {
    path: "/",
    element: <DashboardLayout />,
    loader: protectedLoader,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: "produtos", element: <ProductsPage /> },
      { path: "pedidos", element: <OrdersPage /> },
      { path: "loja", element: <StoreSettingsPage /> },
      { path: "entregas", element: <CourierPage /> },
    ],
  },
]);
