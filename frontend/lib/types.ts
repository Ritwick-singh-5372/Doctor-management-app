export type Patient = {
  id: number;
  name: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  gender: string;
  bloodGroup: string;
  address: string;
  notes: string;
};
export type Doctor = {
  id: number;
  name: string;
  email: string;
  phone: string;
  specialty: string;
  color: string;
};
export type Appointment = {
  id: number;
  patientId: number;
  doctorId: number;
  date: string;
  time: string;
  status: string;
  reason: string;
  duration: number;
  patientName: string;
  doctorName: string;
  specialty: string;
};
export type Section = "Overview" | "Patients" | "Doctors" | "Appointments";
export type Entity = "patients" | "doctors" | "appointments";
export const initials = (name: string) =>
  name
    .replace(/^Dr\.?\s+/i, "")
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("");
export const dateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
export const localDate = (date: string) => new Date(`${date}T12:00:00`);
export const displayDate = (date: string) =>
  localDate(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
export const displayTime = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
};
export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api/${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  const data =
    response.status === 204
      ? null
      : await response.json().catch(() => ({
          error: "The API could not be reached. Check that Flask is running.",
        }));
  if (!response.ok)
    throw new Error(data?.error || "Something went wrong. Please try again.");
  return data;
}
