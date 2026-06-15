// Run with:  node supabase/functions/import-bca-emails/parser.test.ts
// (Node 24 strips TS types natively.) No secrets or network required.
import { parseBcaEmail, parseAmount, parseDate } from "./parser.ts";

let failures = 0;
function check(name: string, cond: boolean, got?: unknown) {
  if (cond) {
    console.log(`  ok  ${name}`);
  } else {
    failures++;
    console.log(`FAIL  ${name}` + (got !== undefined ? ` -> got: ${JSON.stringify(got)}` : ""));
  }
}

// The real (redacted) sample the user provided, as a collapsed single line —
// the hardest case because all fields run together with tabs/colons.
const SAMPLE = `Hello DEVON SAMUEL LAIJRAN,You just made a transaction through myBCA.Here are the details of your transaction :Status \t: \tSuccessfulTransaction Date \t: \t12 Jun 2026 14:41:13Transfer Type \t: \tTransfer to BCA Virtual AccountSource of Fund \t: \t2900xxxx07BCA Virtual Account No. \t: \t393580895604499617Name \t: \tOVO 0895604499617Company/Product Name \t: \tPT VISIONET INTERNASIONAL / OVOPay Amount \t: \tIDR 15,000.00Total Payment \t: \tIDR 15,000.00Description \t: \tReference No. \t: \tB133F61D-6916-44DB-A57D-57C8EAA67D2BNote(s):Fees Include VAT (if any)`;

console.log("parseBcaEmail(SAMPLE):");
const t = parseBcaEmail(SAMPLE);
console.log(JSON.stringify(t, null, 2));

check("not null", t !== null);
if (t) {
  check("date = 2026-06-12", t.date === "2026-06-12", t.date);
  check("amount = 15000", t.amount === 15000, t.amount);
  check("type = DB", t.type === "DB", t.type);
  check("ref correct", t.ref === "B133F61D-6916-44DB-A57D-57C8EAA67D2B", t.ref);
  check("description contains OVO", /OVO/.test(t.description), t.description);
  check("description has transfer type", /TRANSFER TO BCA VIRTUAL ACCOUNT/.test(t.description), t.description);
  check("description is uppercase", t.description === t.description.toUpperCase(), t.description);
}

// A variant with NO merchant fields — description must fall back, never blank.
const NO_MERCHANT = `You just made a transaction through myBCA.Transaction Date \t: \t05 Jul 2026 09:00:00Transfer Type \t: \tBI-FAST Transfer to Other BankTotal Payment \t: \tIDR 250,000.00Reference No. \t: \tZZZ-1Note(s):x`;
const nm = parseBcaEmail(NO_MERCHANT);
console.log("\nparseBcaEmail(NO_MERCHANT):", JSON.stringify(nm));
check("no-merchant: parsed", nm !== null);
if (nm) {
  check("no-merchant: desc not blank", nm.description.length > 0, nm.description);
  check("no-merchant: desc = transfer type", nm.description === "BI-FAST TRANSFER TO OTHER BANK", nm.description);
  check("no-merchant: amount", nm.amount === 250000, nm.amount);
}

// Same content but as real HTML table rows (closer to an actual email body).
const SAMPLE_HTML = `<html><body><p>Hello DEVON,</p><p>You just made a transaction through myBCA.</p>
<table>
<tr><td>Status</td><td>:</td><td>Successful</td></tr>
<tr><td>Transaction Date</td><td>:</td><td>12 Jun 2026 14:41:13</td></tr>
<tr><td>Transfer Type</td><td>:</td><td>Transfer to BCA Virtual Account</td></tr>
<tr><td>Company/Product Name</td><td>:</td><td>PT VISIONET INTERNASIONAL / OVO</td></tr>
<tr><td>Total Payment</td><td>:</td><td>IDR&nbsp;15,000.00</td></tr>
<tr><td>Reference No.</td><td>:</td><td>B133F61D-6916-44DB-A57D-57C8EAA67D2B</td></tr>
</table></body></html>`;

console.log("\nparseBcaEmail(SAMPLE_HTML):");
const h = parseBcaEmail(SAMPLE_HTML);
console.log(JSON.stringify(h, null, 2));
check("html: not null", h !== null);
if (h) {
  check("html: date", h.date === "2026-06-12", h.date);
  check("html: amount", h.amount === 15000, h.amount);
  check("html: ref", h.ref === "B133F61D-6916-44DB-A57D-57C8EAA67D2B", h.ref);
  check("html: desc", /VISIONET/.test(h.description), h.description);
}

// Amount-format edge cases.
console.log("\namount formats:");
check("US 15,000.00", parseAmount("IDR 15,000.00") === 15000, parseAmount("IDR 15,000.00"));
check("ID 15.000,00", parseAmount("Rp15.000,00") === 15000, parseAmount("Rp15.000,00"));
check("comma thousands 1,500,000", parseAmount("1,500,000") === 1500000, parseAmount("1,500,000"));
check("plain 250000", parseAmount("IDR 250000") === 250000, parseAmount("IDR 250000"));

console.log("\ndate formats:");
check("english Jun", parseDate("12 Jun 2026 14:41:13") === "2026-06-12", parseDate("12 Jun 2026 14:41:13"));
check("indo Mei", parseDate("3 Mei 2026") === "2026-05-03", parseDate("3 Mei 2026"));
check("indo Des", parseDate("25 Des 2025") === "2025-12-25", parseDate("25 Des 2025"));

console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} FAILED`);
if (failures > 0) process.exit(1);
