import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";

const runId = `e2e-${Date.now()}`;
const patientName = `Test Patient ${runId}`;
const doctorName = `Dr. Test Doctor ${runId}`;
const reason = `Annual checkup ${runId}`;

async function navigate(page: Page, name: string) {
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name: new RegExp(`^${name}(?:\\s*\\d+)?$`) })
    .click();
}

async function records(request: APIRequestContext, entity: string) {
  const response = await request.get(`/api/${entity}`);
  expect(response.ok()).toBeTruthy();
  return response.json() as Promise<Array<Record<string, string | number>>>;
}

async function cleanup(request: APIRequestContext) {
  for (const a of await records(request, "appointments")) {
    if (String(a.reason).includes(runId)) {
      expect(
        (await request.delete(`/api/appointments/${a.id}`)).ok(),
      ).toBeTruthy();
    }
  }
  for (const entity of ["patients", "doctors"]) {
    for (const record of await records(request, entity)) {
      if (String(record.name).includes(runId)) {
        expect(
          (await request.delete(`/api/${entity}/${record.id}`)).ok(),
        ).toBeTruthy();
      }
    }
  }
}

test.afterEach(async ({ request }) => {
  await cleanup(request);
});

test("clinic records and appointments persist through the real PostgreSQL API", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "A good day to make a difference." }),
  ).toBeVisible();
  await expect(page.getByText("Getting your clinic ready…")).toBeHidden();
  await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
  await page.screenshot({ path: "/tmp/careflow-desktop.png", fullPage: true });

  await navigate(page, "Patients");
  await page.getByRole("button", { name: "Add patient", exact: true }).click();
  let dialog = page.getByRole("dialog", { name: "New patient" });
  await dialog.getByLabel("Full name").fill(patientName);
  await dialog.getByLabel("Email address").fill(`${runId}@example.com`);
  await dialog.getByLabel("Phone number").fill("+1 555 000 1234");
  await dialog.getByLabel("Date of birth").fill("1992-04-12");
  await dialog.getByLabel("Gender").selectOption("Other");
  // Exercise the actual default rather than selecting a known blood group.
  await expect(dialog.getByLabel("Blood group")).toHaveValue("Unknown");
  await dialog.getByLabel("Address", { exact: true }).fill("12 Evergreen Lane");
  await dialog
    .getByLabel("Clinical notes")
    .fill("Synthetic end-to-end test record.");
  await dialog
    .getByRole("button", { name: "Add patient", exact: true })
    .click();
  await expect(dialog).toBeHidden();
  await expect(
    page.getByRole("button", { name: patientName, exact: true }),
  ).toBeVisible();
  const patient = (await records(request, "patients")).find(
    (p) => p.name === patientName,
  )!;
  expect(patient.bloodGroup).toBe("Unknown");

  await page.getByLabel("Search patients").fill("this-person-does-not-exist");
  await expect(
    page.getByRole("heading", { name: "No patients found" }),
  ).toBeVisible();
  await page.getByLabel("Search patients").fill(runId);
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page
    .getByRole("button", { name: `Edit ${patientName}`, exact: true })
    .click();
  dialog = page.getByRole("dialog", { name: "Edit patient" });
  await dialog.getByLabel("Phone number").fill("+1 555 000 9876");
  await dialog
    .getByLabel("Clinical notes")
    .fill("Updated synthetic clinical notes.");
  await dialog.getByRole("button", { name: "Save changes" }).click();
  await expect(dialog).toBeHidden();
  await page.getByRole("button", { name: patientName, exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Patient details" }),
  ).toContainText("Updated synthetic clinical notes.");
  await page.getByRole("button", { name: "Close patient details" }).click();

  await navigate(page, "Doctors");
  await page.getByRole("button", { name: "Add doctor", exact: true }).click();
  dialog = page.getByRole("dialog", { name: "New doctor" });
  await dialog.getByLabel("Full name").fill(doctorName);
  await dialog.getByLabel("Email address").fill(`doctor-${runId}@example.com`);
  await dialog.getByLabel("Phone number").fill("+1 555 111 1111");
  await dialog.getByLabel("Specialty", { exact: true }).fill("Test Medicine");
  await dialog.getByLabel("Profile color").selectOption("lavender");
  await dialog.getByRole("button", { name: "Add doctor", exact: true }).click();
  await expect(dialog).toBeHidden();
  await page
    .getByLabel("Filter doctors by specialty")
    .selectOption("Test Medicine");
  await expect(page.locator(".doctor-card")).toHaveCount(1);
  const doctor = (await records(request, "doctors")).find(
    (d) => d.name === doctorName,
  )!;

  await page
    .getByRole("button", { name: "Book appointment", exact: true })
    .click();
  dialog = page.getByRole("dialog", { name: "New appointment" });
  const future = new Date();
  future.setDate(future.getDate() + 60);
  const appointmentDate = future.toISOString().slice(0, 10);
  await dialog
    .getByRole("combobox", { name: /^Patient/ })
    .selectOption(String(patient.id));
  await expect(dialog.getByRole("combobox", { name: /^Doctor/ })).toHaveValue(
    String(doctor.id),
  );
  await dialog.getByLabel("Date", { exact: true }).fill(appointmentDate);
  await dialog.getByLabel("Time", { exact: true }).fill("11:15");
  await dialog.getByLabel("Reason for visit").fill(reason);
  await dialog
    .getByRole("button", { name: "Add appointment", exact: true })
    .click();
  await expect(dialog).toBeHidden();

  await navigate(page, "Appointments");
  await page.getByLabel("Search records").fill(runId);
  await page.getByLabel("Filter appointments by date").fill(appointmentDate);
  await page
    .getByLabel("Filter appointments by status")
    .selectOption("Scheduled");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(page.locator("tbody tr")).toContainText(reason);

  await page
    .getByRole("button", { name: "New appointment", exact: true })
    .click();
  dialog = page.getByRole("dialog", { name: "New appointment" });
  await dialog
    .getByRole("combobox", { name: /^Patient/ })
    .selectOption(String(patient.id));
  await dialog
    .getByRole("combobox", { name: /^Doctor/ })
    .selectOption(String(doctor.id));
  await dialog.getByLabel("Date", { exact: true }).fill(appointmentDate);
  await dialog.getByLabel("Time", { exact: true }).fill("11:15");
  await dialog
    .getByLabel("Reason for visit")
    .fill(`Conflicting appointment ${runId}`);
  await dialog
    .getByRole("button", { name: "Add appointment", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText(
    "already has an appointment",
  );
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();

  await page
    .getByRole("button", {
      name: `Mark ${patientName}'s appointment completed`,
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("heading", { name: "A little room in the schedule" }),
  ).toBeVisible();
  await page
    .getByLabel("Filter appointments by status")
    .selectOption("Completed");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(page.locator("tbody tr .badge")).toHaveText("Completed");
  const appointment = (await records(request, "appointments")).find(
    (a) => a.reason === reason,
  )!;
  expect(appointment.status).toBe("Completed");

  await navigate(page, "Patients");
  await page.getByLabel("Search patients").fill(runId);
  await page
    .getByRole("button", { name: `Delete ${patientName}`, exact: true })
    .click();
  dialog = page.getByRole("dialog", { name: `Delete ${patientName}?` });
  await dialog
    .getByRole("button", { name: "Delete record", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText("appointment history");
  await dialog.getByRole("button", { name: "Keep record" }).click();

  // Remove only this synthetic appointment, then verify history no longer blocks deletion.
  await navigate(page, "Appointments");
  await page.getByLabel("Search records").fill(runId);
  await page
    .getByRole("button", {
      name: `Delete appointment for ${patientName}`,
      exact: true,
    })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete record", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(
    page.getByRole("heading", { name: "A little room in the schedule" }),
  ).toBeVisible();
  await navigate(page, "Patients");
  await page.getByLabel("Search patients").fill(runId);
  await page
    .getByRole("button", { name: `Delete ${patientName}`, exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete record", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(
    page.getByRole("heading", { name: "No patients found" }),
  ).toBeVisible();

  await navigate(page, "Doctors");
  await page
    .getByRole("button", { name: `Delete ${doctorName}`, exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete record", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeHidden();
  expect(
    (await records(request, "patients")).some((p) => p.name === patientName),
  ).toBeFalsy();
  expect(
    (await records(request, "doctors")).some((d) => d.name === doctorName),
  ).toBeFalsy();
});

test("mobile dashboard and navigation fit the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByText("Getting your clinic ready…")).toBeHidden();
  await expect(
    page.getByRole("heading", { name: "A good day to make a difference." }),
  ).toBeVisible();
  await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({ path: "/tmp/careflow-mobile.png", fullPage: true });
  await page.getByRole("button", { name: "Open menu" }).click();
  await navigate(page, "Patients");
  await expect(
    page.getByRole("heading", { name: "Patients", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".sidebar")).not.toHaveClass(/open/);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.getByRole("button", { name: "Add patient", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "New patient" })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
});
