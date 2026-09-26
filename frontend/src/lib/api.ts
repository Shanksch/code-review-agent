import { supabase } from "./supabaseClient";

const API_BASE = "/api"; // Next.js rewrites to backend

async function getAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    "Content-Type": "application/json",
    ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {})
  };
}

export const api = {
  async get<T>(path: string): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: await getAuthHeaders(),
      cache: 'no-store'
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  
  async post<T>(path: string, body: any): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async put<T>(path: string, body: any): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "PUT",
      headers: await getAuthHeaders(),
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async delete<T>(path: string): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "DELETE",
      headers: await getAuthHeaders(),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }
};

export const uploadFile = async (path: string, formData: FormData) => {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {})
    },
    body: formData
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};
