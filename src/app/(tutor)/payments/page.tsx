import { MarkPaidButton, PaymentForm } from "@/components/tutor/payment-form";
import { requireTutorPage } from "@/server/require-tutor-page";
import {
  getPaymentsOverview,
  listPaymentHistory,
} from "@/server/services/payments";
import { listStudents } from "@/server/services/students";

export default async function PaymentsPage() {
  const tutor = await requireTutorPage();
  const [overview, history, students] = await Promise.all([
    getPaymentsOverview(tutor.id),
    listPaymentHistory(tutor.id, { limit: 20, offset: 0 }),
    listStudents(tutor.id),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Payments</h1>
        <p className="text-sm text-zinc-500">
          Manual cash / M-Pesa tracking. Live Daraja is out of scope.
        </p>
      </div>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-md border border-zinc-200 p-4 dark:border-zinc-800">
          <p className="text-sm text-zinc-500">Pending this month</p>
          <p className="mt-2 text-2xl font-semibold">
            {overview.pending_count} · KES {overview.pending_amount}
          </p>
        </div>
        <div className="rounded-md border border-zinc-200 p-4 dark:border-zinc-800">
          <p className="text-sm text-zinc-500">Paid this month</p>
          <p className="mt-2 text-2xl font-semibold">
            {overview.completed_count} · KES {overview.completed_amount}
          </p>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Record a payment</h2>
        <PaymentForm
          students={students.map((student) => ({
            id: student.id,
            first_name: student.first_name,
          }))}
          defaultMonth={overview.period_month}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">History</h2>
        {history.payments.length === 0 ? (
          <p className="text-sm text-zinc-500">No payment rows yet.</p>
        ) : (
          <ul className="divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {history.payments.map((item) => (
              <li
                key={item.id}
                className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-medium">
                    {item.student_name ?? "Student"} · KES {item.amount}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {item.period_month.slice(0, 7)} · {item.status}
                    {item.mpesa_receipt ? ` · ${item.mpesa_receipt}` : ""}
                  </p>
                </div>
                {item.status === "pending" ? (
                  <MarkPaidButton paymentId={item.id} />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
