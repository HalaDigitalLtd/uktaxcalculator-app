"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../../../../../../lib/supabaseClient";

type Row = Record<string, any>;

type CategoryOption = {
  value: string;
  label: string;
  type: "income" | "expense";
};

type CsvMapping = {
  date: string;
  description: string;
  amount: string;
  category: string;
};

type CsvPreviewRow = {
  rowNumber: number;
  raw: Row;
  transaction_date: string;
  description: string;
  category: string;
  entry_type: "income" | "expense";
  amount: number;
  import_row_hash: string;
  status: "ready" | "duplicate" | "invalid";
  issue: string;
};

const READY_STATUSES = [
  "prepared",
  "submitted",
  "finalised",
  "accepted",
  "ready_to_submit",
  "approved",
];

const CATEGORY_OPTIONS: CategoryOption[] = [
  { value: "turnover", label: "Turnover / Sales", type: "income" },
  { value: "other_income", label: "Other Income", type: "income" },
  { value: "cost_of_goods", label: "Cost Of Goods", type: "expense" },
  { value: "rent", label: "Rent", type: "expense" },
  { value: "utilities", label: "Utilities", type: "expense" },
  { value: "software", label: "Software", type: "expense" },
  { value: "travel", label: "Travel", type: "expense" },
  { value: "motor_expenses", label: "Motor Expenses", type: "expense" },
  { value: "professional_fees", label: "Professional Fees", type: "expense" },
  { value: "advertising", label: "Advertising", type: "expense" },
  { value: "telephone", label: "Telephone", type: "expense" },
  { value: "insurance", label: "Insurance", type: "expense" },
  { value: "repairs", label: "Repairs", type: "expense" },
  { value: "salaries", label: "Salaries", type: "expense" },
  { value: "subcontractors", label: "Subcontractors", type: "expense" },
  { value: "mortgage_interest", label: "Mortgage Interest", type: "expense" },
  { value: "agent_fees", label: "Agent Fees", type: "expense" },
];

function money(value: any) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(Number(value || 0));
}

function sourceLabel(value: any) {
  const clean = String(value || "unknown")
    .replaceAll("-", " ")
    .replaceAll("_", " ");

  return clean.replace(/\b\w/g, (c) => c.toUpperCase());
}

function evidenceLabel(value: any) {
  const clean = String(value || "unverified").replaceAll("_", " ");
  return clean.replace(/\b\w/g, (c) => c.toUpperCase());
}

function toNumber(value: any) {
  const clean = String(value ?? "")
    .replaceAll(",", "")
    .replaceAll("£", "")
    .trim();

  const n = Number(clean || 0);
  return Number.isFinite(n) ? n : 0;
}

function normaliseText(value: any) {
  return String(value || "").trim().toLowerCase();
}

function formatPeriod(start?: string, end?: string) {
  if (!start && !end) return "Not mapped";
  return `${start || "?"} to ${end || "?"}`;
}

function isDateWithinPeriod(date: string, start?: string, end?: string) {
  if (!date || !start || !end) return true;
  return date >= start && date <= end;
}

function getCategoryMeta(category: string) {
  return (
    CATEGORY_OPTIONS.find((option) => option.value === category) ||
    CATEGORY_OPTIONS[0]
  );
}

function normaliseDate(value: any) {
  const raw = String(value || "").trim();

  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const slashMatch = raw.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/);

  if (slashMatch) {
    const day = slashMatch[1].padStart(2, "0");
    const month = slashMatch[2].padStart(2, "0");
    const year =
      slashMatch[3].length === 2 ? `20${slashMatch[3]}` : slashMatch[3];

    return `${year}-${month}-${day}`;
  }

  const parsed = new Date(raw);

  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return "";
}

function guessCategory(value: any) {
  const clean = normaliseText(value).replaceAll(" ", "_").replaceAll("-", "_");

  if (!clean) return "turnover";

  const exact = CATEGORY_OPTIONS.find((option) => option.value === clean);
  if (exact) return exact.value;

  const byLabel = CATEGORY_OPTIONS.find(
    (option) => normaliseText(option.label) === normaliseText(value)
  );
  if (byLabel) return byLabel.value;

  if (clean.includes("rent")) return "rent";
  if (clean.includes("software")) return "software";
  if (clean.includes("travel")) return "travel";
  if (clean.includes("motor")) return "motor_expenses";
  if (clean.includes("professional")) return "professional_fees";
  if (clean.includes("advert")) return "advertising";
  if (clean.includes("phone") || clean.includes("telephone")) return "telephone";
  if (clean.includes("insurance")) return "insurance";
  if (clean.includes("repair")) return "repairs";
  if (clean.includes("salary") || clean.includes("wage")) return "salaries";
  if (clean.includes("subcontract")) return "subcontractors";
  if (clean.includes("agent")) return "agent_fees";
  if (clean.includes("mortgage")) return "mortgage_interest";
  if (clean.includes("utility")) return "utilities";
  if (clean.includes("cost")) return "cost_of_goods";

  return "turnover";
}

function createImportRowHash(input: {
  quarter_income_source_id: string;
  transaction_date: string;
  description: string;
  category: string;
  amount: number;
}) {
  return [
    input.quarter_income_source_id,
    input.transaction_date,
    normaliseText(input.description),
    input.category,
    Number(input.amount || 0).toFixed(2),
  ].join("|");
}

function createSimpleFileHash(input: string) {
  let hash = 0;

  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }

  return `csv_${Math.abs(hash)}_${input.length}`;
}

function parseCsvLine(line: string) {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  result.push(current.trim());
  return result;
}

function parseCsvText(text: string) {
  const lines = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((line) => line.trim() !== "");

  if (lines.length < 2) {
    return { headers: [], rows: [] as Row[] };
  }

  const headers = parseCsvLine(lines[0]).map((header) => header.trim());

  const rows = lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row: Row = {};

    headers.forEach((header, index) => {
      row[header] = values[index] ?? "";
    });

    return row;
  });

  return { headers, rows };
}

function inferMapping(headers: string[]): CsvMapping {
  const findHeader = (terms: string[]) =>
    headers.find((header) => {
      const clean = normaliseText(header);
      return terms.some((term) => clean.includes(term));
    }) || "";

  return {
    date: findHeader(["date", "transaction date", "txn date"]),
    description: findHeader(["description", "details", "narrative", "memo"]),
    amount: findHeader(["amount", "value", "paid", "received", "gross"]),
    category: findHeader(["category", "type", "nominal", "account"]),
  };
}

function evidenceBadgeStyle(status: any): CSSProperties {
  return String(status || "").toLowerCase() === "verified"
    ? styles.verifiedBadge
    : styles.unverifiedBadge;
}

export default function QuarterWorkspacePage() {
  const params = useParams();
  const router = useRouter();

  const clientId = String(params.clientId || "");
  const taxYearId = String(params.taxYearId || "");
  const quarterId = String(params.quarterId || "");

  const [client, setClient] = useState<Row | null>(null);
  const [taxYear, setTaxYear] = useState<Row | null>(null);
  const [quarter, setQuarter] = useState<Row | null>(null);
  const [workflow, setWorkflow] = useState<Row | null>(null);

  const [firmId, setFirmId] = useState("");
  const [authUser, setAuthUser] = useState<Row | null>(null);
  const [membership, setMembership] = useState<Row | null>(null);

  const [sourceRows, setSourceRows] = useState<Row[]>([]);
  const [transactions, setTransactions] = useState<Row[]>([]);
  const [importBatches, setImportBatches] = useState<Row[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState("");

  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [systemWarning, setSystemWarning] = useState("");

  const [newTransaction, setNewTransaction] = useState<Row>({
    transaction_date: "",
    description: "",
    category: "turnover",
    amount: "",
  });

  const [editingTransactionId, setEditingTransactionId] = useState("");
  const [showExcludedTransactions, setShowExcludedTransactions] = useState(false);

  const [csvFileName, setCsvFileName] = useState("");
  const [csvFileHash, setCsvFileHash] = useState("");
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<Row[]>([]);
  const [csvMapping, setCsvMapping] = useState<CsvMapping>({
    date: "",
    description: "",
    amount: "",
    category: "",
  });

  const taxYearLocked = Boolean(
    workflow?.submitted ||
      workflow?.locked ||
      workflow?.is_locked ||
      workflow?.status === "submitted" ||
      workflow?.status === "accepted"
  );

  const selectedSource = useMemo(() => {
    return sourceRows.find((row) => row.id === selectedSourceId) || null;
  }, [sourceRows, selectedSourceId]);

  const sourceLocked = Boolean(
    selectedSource?.locked ||
      selectedSource?.obligation_locked ||
      selectedSource?.workflow_state === "locked" ||
      selectedSource?.status === "submitted" ||
      selectedSource?.status === "accepted" ||
      selectedSource?.last_submission_status === "accepted"
  );

  const workspaceLocked = taxYearLocked || sourceLocked;

  const filteredTransactions = useMemo(() => {
    if (!selectedSourceId) return [];

    return transactions.filter((row) => {
      if (row.quarter_income_source_id !== selectedSourceId) return false;
      if (showExcludedTransactions) return true;
      return row.posting_status !== "excluded" && row.posting_status !== "superseded";
    });
  }, [transactions, selectedSourceId, showExcludedTransactions]);

  const activeTransactions = useMemo(() => {
    return transactions.filter(
      (row) => row.posting_status !== "excluded" && row.posting_status !== "superseded"
    );
  }, [transactions]);

  const selectedImportBatches = useMemo(() => {
    if (!selectedSourceId) return [];
    return importBatches.filter(
      (batch) => batch.quarter_income_source_id === selectedSourceId
    );
  }, [importBatches, selectedSourceId]);

  const totals = useMemo(() => {
    let income = 0;
    let expenses = 0;

    filteredTransactions
      .filter(
        (row) =>
          row.posting_status !== "excluded" && row.posting_status !== "superseded"
      )
      .forEach((row) => {
        const amount = toNumber(row.amount);

        if (row.entry_type === "income") income += amount;
        if (row.entry_type === "expense") expenses += amount;
      });

    return {
      income,
      expenses,
      profit: income - expenses,
    };
  }, [filteredTransactions]);

  const csvPreviewRows = useMemo<CsvPreviewRow[]>(() => {
    if (!selectedSource || csvRows.length === 0) return [];

    const existingHashes = new Set(
      activeTransactions.map((row) =>
        String(
          row.source_row_hash ||
            createImportRowHash({
              quarter_income_source_id: String(row.quarter_income_source_id || ""),
              transaction_date: String(row.transaction_date || ""),
              description: String(row.description || ""),
              category: String(row.category || ""),
              amount: toNumber(row.amount),
            })
        )
      )
    );

    const seenInThisFile = new Set<string>();

    return csvRows.map((row, index) => {
      const transactionDate = normaliseDate(row[csvMapping.date]);
      const description = String(row[csvMapping.description] || "").trim();
      const category = guessCategory(row[csvMapping.category]);
      const categoryMeta = getCategoryMeta(category);
      const amount = Math.abs(toNumber(row[csvMapping.amount]));

      const importRowHash = createImportRowHash({
        quarter_income_source_id: selectedSource.id,
        transaction_date: transactionDate,
        description,
        category,
        amount,
      });

      let status: CsvPreviewRow["status"] = "ready";
      let issue = "";

      if (!transactionDate) {
        status = "invalid";
        issue = "Missing or invalid date";
      } else if (
        !isDateWithinPeriod(
          transactionDate,
          selectedSource.period_start || quarter?.start_date,
          selectedSource.period_end || quarter?.end_date
        )
      ) {
        status = "invalid";
        issue = "Date outside HMRC period";
      } else if (!description) {
        status = "invalid";
        issue = "Missing description";
      } else if (amount <= 0) {
        status = "invalid";
        issue = "Missing or invalid amount";
      } else if (existingHashes.has(importRowHash)) {
        status = "duplicate";
        issue = "Duplicate already in ledger";
      } else if (seenInThisFile.has(importRowHash)) {
        status = "duplicate";
        issue = "Duplicate inside this CSV";
      }

      seenInThisFile.add(importRowHash);

      return {
        rowNumber: index + 2,
        raw: row,
        transaction_date: transactionDate,
        description,
        category,
        entry_type: categoryMeta.type,
        amount,
        import_row_hash: importRowHash,
        status,
        issue,
      };
    });
  }, [
    activeTransactions,
    csvMapping.amount,
    csvMapping.category,
    csvMapping.date,
    csvMapping.description,
    csvRows,
    quarter?.end_date,
    quarter?.start_date,
    selectedSource,
  ]);

  const csvStats = useMemo(() => {
    return {
      total: csvPreviewRows.length,
      ready: csvPreviewRows.filter((row) => row.status === "ready").length,
      duplicate: csvPreviewRows.filter((row) => row.status === "duplicate")
        .length,
      invalid: csvPreviewRows.filter((row) => row.status === "invalid").length,
    };
  }, [csvPreviewRows]);

  const clientName = useMemo(() => {
    if (!client) return "Client";

    return (
      `${client.first_name || ""} ${client.last_name || ""}`.trim() ||
      client.client_name ||
      client.name ||
      client.email ||
      "Client"
    );
  }, [client]);

  const canUseWorkspace = Boolean(
    authUser &&
      firmId &&
      membership &&
      membership.status === "active" &&
      membership.is_active === true
  );

  async function resolveFirmId() {
    const impersonatedFirmId =
      typeof window !== "undefined"
        ? localStorage.getItem("impersonate_firm_id")
        : null;

    const { data, error } = await supabase.rpc("get_current_active_firm_id", {
      impersonated_firm_id: impersonatedFirmId || null,
    });

    if (error || !data) {
      throw new Error(error?.message || "No active firm access found.");
    }

    return String(data);
  }

  async function loadData(preferredSourceId?: string) {
    setLoading(true);
    setMessage("");
    setSystemWarning("");

    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();

      if (authError) throw authError;

      if (!authData.user) {
        router.replace("/auth/login");
        return;
      }

      setAuthUser(authData.user);

      const resolvedFirmId = await resolveFirmId();

      const { data: quarterData, error: quarterError } = await supabase
        .from("quarters")
        .select("*")
        .eq("id", quarterId)
        .eq("tax_year_id", taxYearId)
        .maybeSingle();

      if (quarterError) throw quarterError;

      if (!quarterData) {
        throw new Error(
          "Quarter not found or your firm does not have access to this quarter."
        );
      }

      const workspaceFirmId = String(quarterData.firm_id || resolvedFirmId);

      setFirmId(workspaceFirmId);
      setQuarter(quarterData);

      const { data: membershipData, error: membershipError } = await supabase
        .from("firm_users")
        .select("firm_id,user_id,email,role,status,is_active")
        .eq("firm_id", workspaceFirmId)
        .eq("user_id", authData.user.id)
        .maybeSingle();

      if (membershipError) throw membershipError;

      setMembership(membershipData || null);

      if (
        !membershipData ||
        membershipData.status !== "active" ||
        membershipData.is_active !== true
      ) {
        setSystemWarning(
          "Your login is valid, but this user is not an active member of the firm that owns this quarter."
        );
      }

      const { data: clientData, error: clientError } = await supabase
        .from("clients")
        .select("*")
        .eq("id", clientId)
        .eq("firm_id", workspaceFirmId)
        .maybeSingle();

      if (clientError) throw clientError;
      setClient(clientData || null);

      const { data: taxYearData, error: taxYearError } = await supabase
        .from("tax_years")
        .select("*")
        .eq("id", taxYearId)
        .eq("firm_id", workspaceFirmId)
        .maybeSingle();

      if (taxYearError) throw taxYearError;
      setTaxYear(taxYearData || null);

      const { data: workflowData, error: workflowError } = await supabase
        .from("tax_year_final_declarations")
        .select("*")
        .eq("client_id", clientId)
        .eq("tax_year_id", taxYearId)
        .eq("firm_id", workspaceFirmId)
        .maybeSingle();

      if (workflowError) throw workflowError;
      setWorkflow(workflowData || null);

      const { data: sourceData, error: sourceError } = await supabase
        .from("quarter_income_sources")
        .select("*")
        .eq("quarter_id", quarterId)
        .eq("tax_year_id", taxYearId)
        .eq("client_id", clientId)
        .eq("firm_id", workspaceFirmId)
        .order("canonical_source_type", { ascending: true })
        .order("hmrc_source", { ascending: true });

      if (sourceError) throw sourceError;

      const sources = sourceData || [];
      setSourceRows(sources);

      const nextSourceId =
        preferredSourceId && sources.some((row) => row.id === preferredSourceId)
          ? preferredSourceId
          : selectedSourceId &&
              sources.some((row) => row.id === selectedSourceId)
            ? selectedSourceId
            : sources.length > 0
              ? sources[0].id
              : "";

      setSelectedSourceId(nextSourceId);

      const { data: ledgerData, error: ledgerError } = await supabase
        .from("ledger_entries")
        .select("*")
        .eq("quarter_id", quarterId)
        .eq("tax_year_id", taxYearId)
        .eq("client_id", clientId)
        .eq("firm_id", workspaceFirmId)
        .order("transaction_date", { ascending: false })
        .order("created_at", { ascending: false });

      if (ledgerError) throw ledgerError;
      setTransactions(ledgerData || []);

      const { data: batchData, error: batchError } = await supabase
        .from("ledger_batches")
        .select("*")
        .eq("quarter_id", quarterId)
        .eq("tax_year_id", taxYearId)
        .eq("client_id", clientId)
        .eq("firm_id", workspaceFirmId)
        .order("created_at", { ascending: false });

      if (batchError) throw batchError;
      setImportBatches(batchData || []);

      if (sources.length === 0 && membershipData?.is_active === true) {
        setSystemWarning(
          "No HMRC income sources are mapped for this quarter. Go back to the Tax Year Control Centre and run HMRC sync/source mapping."
        );
      }
    } catch (e: any) {
      setMessage(e.message || "Failed loading workspace.");
    }

    setLoading(false);
  }

  useEffect(() => {
    if (clientId && taxYearId && quarterId) {
      loadData();
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, taxYearId, quarterId]);

  async function recalculateSourceTotals(sourceRowId: string) {
    const { error } = await supabase.rpc(
      "recalculate_quarter_income_source_from_ledger",
      {
        p_quarter_income_source_id: sourceRowId,
      }
    );

    if (error) throw error;
  }

  function buildLedgerCommonPayload() {
    if (!selectedSource) throw new Error("Select income source first.");

    return {
      firm_id: firmId,
      client_id: clientId,
      tax_year_id: taxYearId,
      quarter_id: quarterId,
      quarter_income_source_id: selectedSource.id,
      income_source_id:
        selectedSource.income_source_id ||
        selectedSource.hmrc_income_source_id ||
        selectedSource.canonical_income_source_id ||
        null,
      official_obligation_id: selectedSource.official_obligation_id || null,
    };
  }

  async function addTransaction() {
    if (!canUseWorkspace) {
      setMessage("You do not have active firm access for this workspace.");
      return;
    }

    if (workspaceLocked) {
      setMessage("This source is locked. Use amendment workflow.");
      return;
    }

    if (!selectedSource) {
      setMessage("Select income source.");
      return;
    }

    const amount = toNumber(newTransaction.amount);

    if (!newTransaction.transaction_date) {
      setMessage("Enter transaction date.");
      return;
    }

    if (
      !isDateWithinPeriod(
        newTransaction.transaction_date,
        selectedSource.period_start || quarter?.start_date,
        selectedSource.period_end || quarter?.end_date
      )
    ) {
      setMessage("Transaction date is outside this HMRC reporting period.");
      return;
    }

    if (!String(newTransaction.description || "").trim()) {
      setMessage("Enter transaction description.");
      return;
    }

    if (amount <= 0) {
      setMessage("Enter a positive amount.");
      return;
    }

    const categoryMeta = getCategoryMeta(newTransaction.category);
    const common = buildLedgerCommonPayload();

    setSaving(true);

    try {
      const now = new Date().toISOString();
      const rowHash = createImportRowHash({
        quarter_income_source_id: selectedSource.id,
        transaction_date: newTransaction.transaction_date,
        description: String(newTransaction.description || "").trim(),
        category: newTransaction.category,
        amount,
      });

      const payload = {
        ...common,
        transaction_date: newTransaction.transaction_date,
        description: String(newTransaction.description || "").trim(),
        reference: null,
        category: newTransaction.category,
        hmrc_category: newTransaction.category,
        entry_type: categoryMeta.type,
        amount,
        source_row_hash: rowHash,
        source_raw_data: {
          source: "manual_entry",
          entered_at: now,
          entered_by: authUser?.email || authUser?.id || null,
        },
        digital_link_source: "manual_entry",
        digital_link_chain: {
          source: "manual_entry",
          quarter_income_source_id: selectedSource.id,
          official_obligation_id: selectedSource.official_obligation_id || null,
          created_at: now,
        },
        is_adjustment: false,
        review_status: "unreviewed",
        posting_status: "posted",
        created_by: authUser?.id || null,
        created_by_email: authUser?.email || null,
        updated_at: now,
      };

      if (editingTransactionId) {
        const { error } = await supabase
          .from("ledger_entries")
          .update({
            ...payload,
            updated_at: now,
          })
          .eq("id", editingTransactionId)
          .eq("firm_id", firmId)
          .eq("client_id", clientId)
          .eq("tax_year_id", taxYearId)
          .eq("quarter_id", quarterId)
          .eq("locked", false);

        if (error) throw error;
        setMessage("Ledger entry updated.");
      } else {
        const { error } = await supabase.from("ledger_entries").insert(payload);

        if (error) throw error;
        setMessage("Ledger entry added.");
      }

      await recalculateSourceTotals(selectedSource.id);
      await loadData(selectedSource.id);

      setEditingTransactionId("");
      setNewTransaction({
        transaction_date: "",
        description: "",
        category: "turnover",
        amount: "",
      });
    } catch (e: any) {
      setMessage(e.message || "Failed saving ledger entry.");
    }

    setSaving(false);
  }

  function editTransaction(row: Row) {
    if (workspaceLocked) {
      setMessage("Locked records cannot be edited.");
      return;
    }

    if (row.locked) {
      setMessage("This ledger entry is locked.");
      return;
    }

    setEditingTransactionId(row.id);

    setNewTransaction({
      transaction_date: row.transaction_date || "",
      description: row.description || "",
      category: row.category || "turnover",
      amount: String(row.amount || ""),
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function deleteTransaction(row: Row) {
    if (workspaceLocked) {
      setMessage("Locked records cannot be deleted.");
      return;
    }

    if (row.locked) {
      setMessage("This ledger entry is locked.");
      return;
    }

    const reason = window.prompt("Enter exclusion reason for audit trail:");

    if (!reason || !reason.trim()) return;

    setSaving(true);

    try {
      const { error } = await supabase
        .from("ledger_entries")
        .update({
          posting_status: "excluded",
          adjustment_reason: reason.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id)
        .eq("firm_id", firmId)
        .eq("client_id", clientId)
        .eq("tax_year_id", taxYearId)
        .eq("quarter_id", quarterId)
        .eq("locked", false);

      if (error) throw error;

      await recalculateSourceTotals(row.quarter_income_source_id);
      await loadData(selectedSourceId);

      setMessage("Ledger entry excluded from posted totals.");
    } catch (e: any) {
      setMessage(e.message || "Failed excluding ledger entry.");
    }

    setSaving(false);
  }

  async function markSourcePrepared() {
    if (!canUseWorkspace) {
      setMessage("You do not have active firm access for this workspace.");
      return;
    }

    if (!selectedSource) {
      setMessage("Select income source.");
      return;
    }

    if (workspaceLocked) {
      setMessage("This source is locked. Use amendment workflow.");
      return;
    }

    if (selectedSource.source_evidence_status !== "verified") {
      setMessage(
        "This HMRC source is not verified. Run HMRC sync/source mapping before preparing."
      );
      return;
    }

    if (
      filteredTransactions.filter((row) => row.posting_status === "posted")
        .length === 0
    ) {
      setMessage("Add at least one posted ledger entry before marking prepared.");
      return;
    }

    setSaving(true);
    setMessage("Preparing source from ledger...");

    try {
      await recalculateSourceTotals(selectedSource.id);

      const { error } = await supabase
        .from("quarter_income_sources")
        .update({
          status: "prepared",
          bookkeeping_status: "prepared",
          workflow_state: "ready_for_review",
          workflow_state_reason: "Prepared from posted ledger entries.",
          workflow_state_changed_at: new Date().toISOString(),
          workflow_state_changed_by: authUser?.id || null,
          prepared_at: new Date().toISOString(),
          prepared_by: authUser?.id || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedSource.id)
        .eq("firm_id", firmId)
        .eq("client_id", clientId)
        .eq("tax_year_id", taxYearId)
        .eq("quarter_id", quarterId);

      if (error) throw error;

      await loadData(selectedSource.id);
      setMessage("Income source prepared and moved to review queue.");
    } catch (e: any) {
      setMessage(e.message || "Failed preparing source.");
    }

    setSaving(false);
  }

  function resetCsvImport() {
    setCsvFileName("");
    setCsvFileHash("");
    setCsvHeaders([]);
    setCsvRows([]);
    setCsvMapping({
      date: "",
      description: "",
      amount: "",
      category: "",
    });
  }

  async function handleCsvFile(file?: File | null) {
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setMessage("Please upload a CSV file.");
      return;
    }

    const text = await file.text();
    const parsed = parseCsvText(text);

    if (parsed.headers.length === 0 || parsed.rows.length === 0) {
      setMessage("CSV could not be read. Please check headers and rows.");
      return;
    }

    setCsvFileName(file.name);
    setCsvFileHash(createSimpleFileHash(text));
    setCsvHeaders(parsed.headers);
    setCsvRows(parsed.rows);
    setCsvMapping(inferMapping(parsed.headers));
    setMessage(`CSV loaded: ${file.name}. Review mapping before import.`);
  }

  async function importCsvRows() {
    if (!canUseWorkspace) {
      setMessage("You do not have active firm access for this workspace.");
      return;
    }

    if (workspaceLocked) {
      setMessage("This source is locked. Use amendment workflow.");
      return;
    }

    if (!selectedSource) {
      setMessage("Select income source before importing CSV.");
      return;
    }

    if (selectedSource.source_evidence_status !== "verified") {
      setMessage(
        "This HMRC source is not verified. Run HMRC sync/source mapping before importing."
      );
      return;
    }

    if (!csvMapping.date || !csvMapping.description || !csvMapping.amount) {
      setMessage("Map Date, Description and Amount columns before importing.");
      return;
    }

    const rowsToImport = csvPreviewRows.filter((row) => row.status === "ready");

    if (rowsToImport.length === 0) {
      setMessage("No valid non-duplicate CSV rows available to import.");
      return;
    }

    const now = new Date().toISOString();
    const common = buildLedgerCommonPayload();

    setSaving(true);
    setMessage("Creating ledger import batch...");

    try {
      const { data: batch, error: batchError } = await supabase
        .from("ledger_batches")
        .insert({
          ...common,
          batch_type: "csv_import",
          batch_status: "posted",
          source_filename: csvFileName || "uploaded.csv",
          source_file_hash: csvFileHash || null,
          source_mime_type: "text/csv",
          source_row_count: csvRows.length,
          period_start: selectedSource.period_start || quarter?.start_date || null,
          period_end: selectedSource.period_end || quarter?.end_date || null,
          digital_link_metadata: {
            source: "csv_upload",
            uploaded_at: now,
            uploaded_by: authUser?.email || authUser?.id || null,
            file_name: csvFileName || "uploaded.csv",
            file_hash: csvFileHash || null,
          },
          import_mapping: csvMapping,
          validation_summary: {
            total_rows: csvStats.total,
            imported_rows: rowsToImport.length,
            duplicate_rows: csvStats.duplicate,
            invalid_rows: csvStats.invalid,
          },
          created_by: authUser?.id || null,
          created_by_email: authUser?.email || null,
          updated_at: now,
        })
        .select("*")
        .single();

      if (batchError) throw batchError;

      const payload = rowsToImport.map((row) => ({
        ...common,
        ledger_batch_id: batch.id,
        transaction_date: row.transaction_date,
        description: row.description,
        reference: `CSV row ${row.rowNumber}`,
        category: row.category,
        hmrc_category: row.category,
        entry_type: row.entry_type,
        amount: row.amount,
        source_row_number: row.rowNumber,
        source_row_hash: row.import_row_hash,
        source_raw_data: row.raw,
        digital_link_source: "csv_import",
        digital_link_chain: {
          source: "csv_import",
          ledger_batch_id: batch.id,
          source_filename: csvFileName || "uploaded.csv",
          source_file_hash: csvFileHash || null,
          csv_row_number: row.rowNumber,
          quarter_income_source_id: selectedSource.id,
          official_obligation_id: selectedSource.official_obligation_id || null,
          imported_at: now,
        },
        is_adjustment: false,
        review_status: "unreviewed",
        posting_status: "posted",
        created_by: authUser?.id || null,
        created_by_email: authUser?.email || null,
        updated_at: now,
      }));

      const { error } = await supabase.from("ledger_entries").insert(payload);

      if (error) throw error;

      await recalculateSourceTotals(selectedSource.id);
      await loadData(selectedSource.id);
      resetCsvImport();

      setMessage(
        `CSV import complete. Posted ${rowsToImport.length} ledger entries. Batch: ${batch.id}`
      );
    } catch (e: any) {
      setMessage(e.message || "CSV import failed.");
    }

    setSaving(false);
  }

  async function revertImportBatch(batch: Row) {
    if (!canUseWorkspace || workspaceLocked) {
      setMessage("This workspace is locked or your firm access is inactive.");
      return;
    }

    if (batch.batch_status === "superseded" || batch.locked) {
      setMessage("This batch is already reverted or locked.");
      return;
    }

    const reason = window.prompt(
      `Enter rollback reason for CSV batch ${batch.source_filename}:`
    );

    if (!reason || !reason.trim()) return;

    setSaving(true);
    setMessage("Reverting ledger batch...");

    try {
      const now = new Date().toISOString();

      const { error: txError } = await supabase
        .from("ledger_entries")
        .update({
          posting_status: "excluded",
          adjustment_reason: `Ledger batch reverted: ${reason.trim()}`,
          updated_at: now,
        })
        .eq("firm_id", firmId)
        .eq("client_id", clientId)
        .eq("tax_year_id", taxYearId)
        .eq("quarter_id", quarterId)
        .eq("quarter_income_source_id", batch.quarter_income_source_id)
        .eq("ledger_batch_id", batch.id)
        .eq("posting_status", "posted")
        .eq("locked", false);

      if (txError) throw txError;

      const { error: batchError } = await supabase
        .from("ledger_batches")
        .update({
          batch_status: "superseded",
          validation_summary: {
            ...(batch.validation_summary || {}),
            reverted_at: now,
            reverted_by: authUser?.email || authUser?.id || null,
            revert_reason: reason.trim(),
          },
          updated_at: now,
        })
        .eq("id", batch.id)
        .eq("firm_id", firmId)
        .eq("client_id", clientId)
        .eq("tax_year_id", taxYearId)
        .eq("quarter_id", quarterId)
        .eq("locked", false);

      if (batchError) throw batchError;

await supabase.rpc("reconcile_ledger_batch_status", {
  p_ledger_batch_id: batch.id,
});

await recalculateSourceTotals(batch.quarter_income_source_id);
await loadData(selectedSourceId);

setMessage("Ledger batch reverted. Related entries were excluded.");
    } catch (e: any) {
      setMessage(e.message || "Failed reverting ledger batch.");
    }

    setSaving(false);
  }

  if (loading) {
    return (
      <main style={styles.page}>
        <div style={styles.card}>Loading workspace...</div>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <div style={styles.header}>
        <div>
          <Link
            href={`/dashboard/clients/${clientId}/tax-years/${taxYearId}/summary`}
            style={styles.backLink}
          >
            ← Back To Tax Year Control Centre
          </Link>

          <h1 style={styles.title}>Quarter Workspace</h1>

          <p style={styles.subtitle}>
            Client: <strong>{clientName}</strong>
          </p>

          <p style={styles.subtitle}>
            Tax Year:{" "}
            <strong>{taxYear?.year_label || taxYear?.tax_year || "Tax Year"}</strong>{" "}
            · Quarter: <strong>{quarter?.quarter_name || "Quarter"}</strong>
          </p>
        </div>

        <button
          onClick={() => loadData(selectedSourceId)}
          style={styles.secondaryButton}
        >
          Refresh
        </button>
      </div>

      {message && <div style={styles.message}>{message}</div>}

      {systemWarning && (
        <section style={styles.warningBox}>
          <h2 style={styles.warningTitle}>Workspace Attention Required</h2>
          <p style={styles.warningText}>{systemWarning}</p>
        </section>
      )}

      {!canUseWorkspace && (
        <section style={styles.warningBox}>
          <h2 style={styles.warningTitle}>Firm Access Check</h2>
          <p style={styles.warningText}>
            Logged in user: <strong>{authUser?.email || "Unknown"}</strong>
            <br />
            Workspace firm: <strong>{firmId || "Unknown"}</strong>
            <br />
            Membership status:{" "}
            <strong>{membership?.status || "No active membership found"}</strong>
          </p>
        </section>
      )}

      {workspaceLocked && (
        <section style={styles.lockBanner}>
          <h2 style={styles.lockTitle}>Workspace Locked</h2>
          <p style={styles.lockText}>
            This tax year or HMRC source is locked. Direct ledger changes are
            blocked. Use amendment workflow for changes after submission.
          </p>
        </section>
      )}

      <section style={styles.card}>
        <h2 style={styles.sectionTitle}>HMRC Income Sources</h2>

        {sourceRows.length === 0 && (
          <div style={styles.emptyBox}>
            No HMRC income sources found for this quarter.
          </div>
        )}

        <div style={styles.sourceGrid}>
          {sourceRows.map((row) => {
            const ready = READY_STATUSES.includes(
              String(row.workflow_state || row.status || "")
            );
            const verified = row.source_evidence_status === "verified";

            return (
              <button
                key={row.id}
                onClick={() => setSelectedSourceId(row.id)}
                style={{
                  ...styles.sourceCard,
                  border:
                    selectedSourceId === row.id
                      ? "2px solid #2563eb"
                      : ready
                        ? "2px solid #16a34a"
                        : verified
                          ? "1px solid #bbf7d0"
                          : "1px solid #fed7aa",
                }}
              >
                <div style={styles.sourceTop}>
                  <strong>{sourceLabel(row.hmrc_source)}</strong>

                  <div style={styles.badgeStack}>
                    <span style={styles.badge}>
                      {row.workflow_state || row.status || "open"}
                    </span>
                    <span style={evidenceBadgeStyle(row.source_evidence_status)}>
                      {evidenceLabel(row.source_evidence_status)}
                    </span>
                  </div>
                </div>

                <div style={styles.sourceMeta}>
                  <div>
                    Business ID:
                    <br />
                    {row.hmrc_business_id || "Not mapped"}
                  </div>

                  <div>
                    Canonical Type:
                    <br />
                    {sourceLabel(row.canonical_source_type || row.hmrc_source)}
                  </div>

                  <div>
                    Period:
                    <br />
                    {formatPeriod(
                      row.period_start || quarter?.start_date,
                      row.period_end || quarter?.end_date
                    )}
                  </div>

                  <div>
                    Official Obligation:
                    <br />
                    {row.official_obligation_id
                      ? String(row.official_obligation_id).slice(0, 8)
                      : "Not linked"}
                  </div>

                  <div>
                    Income:
                    <br />
                    {money(row.income)}
                  </div>

                  <div>
                    Expenses:
                    <br />
                    {money(row.expenses)}
                  </div>

                  <div>
                    Profit:
                    <br />
                    {money(row.profit)}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {selectedSource && (
        <>
          <section style={styles.statsGrid}>
            <div style={styles.statCard}>
              <span style={styles.statLabel}>Income</span>
              <strong style={styles.statValue}>{money(totals.income)}</strong>
            </div>

            <div style={styles.statCard}>
              <span style={styles.statLabel}>Expenses</span>
              <strong style={styles.statValue}>{money(totals.expenses)}</strong>
            </div>

            <div style={styles.statCard}>
              <span style={styles.statLabel}>Profit</span>
              <strong style={styles.statValue}>{money(totals.profit)}</strong>
            </div>

            <div style={styles.statCard}>
              <span style={styles.statLabel}>Posted Ledger Entries</span>
              <strong style={styles.statValue}>
                {
                  filteredTransactions.filter(
                    (row) => row.posting_status === "posted"
                  ).length
                }
              </strong>
            </div>
          </section>

          <section style={styles.card}>
            <div style={styles.sectionHeader}>
              <div>
                <h2 style={styles.sectionTitle}>Selected HMRC Source Evidence</h2>
                <p style={styles.muted}>
                  This workspace is linked to the official HMRC obligation,
                  canonical income source and ledger evidence chain.
                </p>
              </div>

              <span
                style={evidenceBadgeStyle(selectedSource.source_evidence_status)}
              >
                {evidenceLabel(selectedSource.source_evidence_status)}
              </span>
            </div>

            <div style={styles.evidenceGrid}>
              <div style={styles.evidenceItem}>
                <span style={styles.evidenceLabel}>HMRC Source</span>
                <strong>{sourceLabel(selectedSource.hmrc_source)}</strong>
              </div>

              <div style={styles.evidenceItem}>
                <span style={styles.evidenceLabel}>Canonical Source Type</span>
                <strong>
                  {sourceLabel(
                    selectedSource.canonical_source_type ||
                      selectedSource.hmrc_source
                  )}
                </strong>
              </div>

              <div style={styles.evidenceItem}>
                <span style={styles.evidenceLabel}>HMRC Business ID</span>
                <strong>{selectedSource.hmrc_business_id || "Not mapped"}</strong>
              </div>

              <div style={styles.evidenceItem}>
                <span style={styles.evidenceLabel}>Canonical Income Source</span>
                <strong>
                  {selectedSource.income_source_id ||
                    selectedSource.hmrc_income_source_id ||
                    "Not linked"}
                </strong>
              </div>

              <div style={styles.evidenceItem}>
                <span style={styles.evidenceLabel}>Official Obligation</span>
                <strong>
                  {selectedSource.official_obligation_id || "Not mapped"}
                </strong>
              </div>

              <div style={styles.evidenceItem}>
                <span style={styles.evidenceLabel}>Period</span>
                <strong>
                  {formatPeriod(
                    selectedSource.period_start || quarter?.start_date,
                    selectedSource.period_end || quarter?.end_date
                  )}
                </strong>
              </div>
            </div>

            {selectedSource.source_evidence_status !== "verified" && (
              <div style={styles.warningInline}>
                This source is not HMRC verified. Do not submit this source until
                HMRC sync/source mapping has linked it to hmrc_income_sources.
              </div>
            )}
          </section>

          <section style={styles.card}>
            <div style={styles.sectionHeader}>
              <div>
                <h2 style={styles.sectionTitle}>CSV Import To Ledger</h2>
                <p style={styles.muted}>
                  CSV rows now post into ledger_entries with batch evidence and
                  digital-link metadata.
                </p>
              </div>

              <button
                onClick={resetCsvImport}
                disabled={saving || csvRows.length === 0}
                style={
                  csvRows.length === 0
                    ? styles.disabledButton
                    : styles.secondaryButton
                }
              >
                Clear Import
              </button>
            </div>

            {!workspaceLocked && canUseWorkspace && (
              <div style={styles.importBox}>
                <label style={styles.label}>
                  Upload CSV
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    onChange={(e) => handleCsvFile(e.target.files?.[0])}
                    style={styles.input}
                  />
                </label>

                {csvFileName && (
                  <div style={styles.importInfo}>
                    Loaded file: <strong>{csvFileName}</strong>
                    <br />
                    File hash: <strong>{csvFileHash || "pending"}</strong>
                  </div>
                )}

                {csvHeaders.length > 0 && (
                  <>
                    <div style={styles.mappingGrid}>
                      {(["date", "description", "amount", "category"] as const).map(
                        (field) => (
                          <label key={field} style={styles.label}>
                            {field === "date"
                              ? "Date Column"
                              : field === "description"
                                ? "Description Column"
                                : field === "amount"
                                  ? "Amount Column"
                                  : "Category Column"}
                            <select
                              value={csvMapping[field]}
                              onChange={(e) =>
                                setCsvMapping({
                                  ...csvMapping,
                                  [field]: e.target.value,
                                })
                              }
                              style={styles.input}
                            >
                              <option value="">
                                {field === "category"
                                  ? "Optional"
                                  : "Select column"}
                              </option>
                              {csvHeaders.map((header) => (
                                <option key={header} value={header}>
                                  {header}
                                </option>
                              ))}
                            </select>
                          </label>
                        )
                      )}
                    </div>

                    <div style={styles.csvStatsGrid}>
                      <div style={styles.statMini}>Rows: {csvStats.total}</div>
                      <div style={styles.statMini}>Ready: {csvStats.ready}</div>
                      <div style={styles.statMini}>
                        Duplicates: {csvStats.duplicate}
                      </div>
                      <div style={styles.statMini}>
                        Invalid: {csvStats.invalid}
                      </div>
                    </div>

                    <button
                      onClick={importCsvRows}
                      disabled={saving || csvStats.ready === 0}
                      style={
                        saving || csvStats.ready === 0
                          ? styles.disabledButton
                          : styles.primaryButton
                      }
                    >
                      {saving
                        ? "Posting..."
                        : `Post ${csvStats.ready} Rows To Ledger`}
                    </button>
                  </>
                )}
              </div>
            )}

            {csvPreviewRows.length > 0 && (
              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>CSV Row</th>
                      <th style={styles.th}>Date</th>
                      <th style={styles.th}>Description</th>
                      <th style={styles.th}>Category</th>
                      <th style={styles.th}>Type</th>
                      <th style={styles.th}>Amount</th>
                      <th style={styles.th}>Status</th>
                    </tr>
                  </thead>

                  <tbody>
                    {csvPreviewRows.slice(0, 50).map((row) => (
                      <tr key={row.rowNumber}>
                        <td style={styles.td}>{row.rowNumber}</td>
                        <td style={styles.td}>{row.transaction_date || "-"}</td>
                        <td style={styles.td}>{row.description || "-"}</td>
                        <td style={styles.td}>{row.category}</td>
                        <td style={styles.td}>{row.entry_type}</td>
                        <td style={styles.td}>{money(row.amount)}</td>
                        <td style={styles.td}>
                          <span
                            style={
                              row.status === "ready"
                                ? styles.readyBadge
                                : row.status === "duplicate"
                                  ? styles.duplicateBadge
                                  : styles.deletedBadge
                            }
                          >
                            {row.status}
                          </span>
                          {row.issue && (
                            <div style={styles.issueText}>{row.issue}</div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section style={styles.card}>
            <h2 style={styles.sectionTitle}>Ledger Batch History</h2>

            {selectedImportBatches.length === 0 && (
              <div style={styles.emptyBox}>No ledger import batches yet.</div>
            )}

            {selectedImportBatches.length > 0 && (
              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Created At</th>
                      <th style={styles.th}>File</th>
                      <th style={styles.th}>Rows</th>
                      <th style={styles.th}>Duplicates</th>
                      <th style={styles.th}>Invalid</th>
                      <th style={styles.th}>Status</th>
                      <th style={styles.th}>Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {selectedImportBatches.map((batch) => (
                      <tr key={batch.id}>
                        <td style={styles.td}>
                          {batch.created_at
                            ? new Date(batch.created_at).toLocaleString("en-GB")
                            : "-"}
                        </td>
                        <td style={styles.td}>
                          {batch.source_filename || "Manual/Unknown"}
                        </td>
                        <td style={styles.td}>
                          {batch.validation_summary?.imported_rows ||
                            batch.source_row_count ||
                            0}
                        </td>
                        <td style={styles.td}>
                          {batch.validation_summary?.duplicate_rows || 0}
                        </td>
                        <td style={styles.td}>
                          {batch.validation_summary?.invalid_rows || 0}
                        </td>
                        <td style={styles.td}>
                          <span
                            style={
                              batch.batch_status === "superseded"
                                ? styles.deletedBadge
                                : styles.readyBadge
                            }
                          >
                            {batch.batch_status}
                          </span>
                        </td>
                        <td style={styles.td}>
                          {batch.batch_status !== "superseded" &&
                            !workspaceLocked && (
                              <button
                                onClick={() => revertImportBatch(batch)}
                                style={styles.deleteButton}
                                disabled={saving}
                              >
                                Revert Batch
                              </button>
                            )}

                          {batch.batch_status === "superseded" && (
                            <span style={styles.issueText}>
                              {batch.validation_summary?.revert_reason ||
                                "Superseded"}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section style={styles.card}>
            <div style={styles.sectionHeader}>
              <div>
                <h2 style={styles.sectionTitle}>Ledger Entries</h2>
                <p style={styles.muted}>
                  Figures are derived from posted ledger entries. Direct total
                  editing is intentionally avoided for HMRC digital-link compliance.
                </p>
              </div>

              <div style={styles.buttonRow}>
                <label style={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={showExcludedTransactions}
                    onChange={(e) =>
                      setShowExcludedTransactions(e.target.checked)
                    }
                  />
                  Show excluded
                </label>

                <button
                  onClick={markSourcePrepared}
                  disabled={!canUseWorkspace || workspaceLocked || saving}
                  style={
                    !canUseWorkspace || workspaceLocked || saving
                      ? styles.disabledButton
                      : styles.primaryButton
                  }
                >
                  Mark Prepared
                </button>
              </div>
            </div>

            {!workspaceLocked && canUseWorkspace && (
              <div style={styles.newTxBox}>
                <div style={styles.formGrid}>
                  <label style={styles.label}>
                    Date
                    <input
                      type="date"
                      value={newTransaction.transaction_date}
                      min={
                        selectedSource.period_start ||
                        quarter?.start_date ||
                        undefined
                      }
                      max={
                        selectedSource.period_end || quarter?.end_date || undefined
                      }
                      onChange={(e) =>
                        setNewTransaction({
                          ...newTransaction,
                          transaction_date: e.target.value,
                        })
                      }
                      style={styles.input}
                    />
                  </label>

                  <label style={styles.label}>
                    Description
                    <input
                      value={newTransaction.description}
                      onChange={(e) =>
                        setNewTransaction({
                          ...newTransaction,
                          description: e.target.value,
                        })
                      }
                      style={styles.input}
                    />
                  </label>

                  <label style={styles.label}>
                    Category
                    <select
                      value={newTransaction.category}
                      onChange={(e) =>
                        setNewTransaction({
                          ...newTransaction,
                          category: e.target.value,
                        })
                      }
                      style={styles.input}
                    >
                      {CATEGORY_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label style={styles.label}>
                    Amount
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={newTransaction.amount}
                      onChange={(e) =>
                        setNewTransaction({
                          ...newTransaction,
                          amount: e.target.value,
                        })
                      }
                      style={styles.input}
                    />
                  </label>
                </div>

                <button
                  onClick={addTransaction}
                  disabled={saving}
                  style={saving ? styles.disabledButton : styles.primaryButton}
                >
                  {saving
                    ? "Saving..."
                    : editingTransactionId
                      ? "Update Ledger Entry"
                      : "Add Ledger Entry"}
                </button>
              </div>
            )}

            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Date</th>
                    <th style={styles.th}>Description</th>
                    <th style={styles.th}>Category</th>
                    <th style={styles.th}>Type</th>
                    <th style={styles.th}>Amount</th>
                    <th style={styles.th}>Source</th>
                    <th style={styles.th}>Batch</th>
                    <th style={styles.th}>Status</th>
                    <th style={styles.th}>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredTransactions.map((row) => (
                    <tr key={row.id}>
                      <td style={styles.td}>{row.transaction_date}</td>
                      <td style={styles.td}>{row.description}</td>
                      <td style={styles.td}>{row.category}</td>
                      <td style={styles.td}>{row.entry_type}</td>
                      <td style={styles.td}>{money(row.amount)}</td>
                      <td style={styles.td}>
                        {row.digital_link_source || "manual"}
                      </td>
                      <td style={styles.td}>
                        {row.ledger_batch_id
                          ? String(row.ledger_batch_id).slice(0, 8)
                          : "-"}
                      </td>
                      <td style={styles.td}>
                        <span
                          style={
                            row.posting_status === "posted"
                              ? styles.readyBadge
                              : styles.deletedBadge
                          }
                        >
                          {row.posting_status}
                        </span>
                      </td>
                      <td style={styles.td}>
                        <div style={styles.actionRow}>
                          {!workspaceLocked &&
                            row.locked !== true &&
                            row.posting_status === "posted" && (
                              <>
                                <button
                                  onClick={() => editTransaction(row)}
                                  style={styles.smallButton}
                                >
                                  Edit
                                </button>

                                <button
                                  onClick={() => deleteTransaction(row)}
                                  style={styles.deleteButton}
                                >
                                  Exclude
                                </button>
                              </>
                            )}

                          {row.posting_status !== "posted" && (
                            <span style={styles.deletedBadge}>
                              {row.posting_status}
                            </span>
                          )}

                          {row.locked === true && (
                            <span style={styles.deletedBadge}>Locked</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}

                  {filteredTransactions.length === 0 && (
                    <tr>
                      <td colSpan={9} style={styles.empty}>
                        No ledger entries yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#f6f8fb",
    padding: "32px",
    fontFamily: "Inter, Arial, sans-serif",
    color: "#111827",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: "20px",
    alignItems: "flex-start",
    marginBottom: "24px",
  },
  backLink: {
    color: "#2563eb",
    textDecoration: "none",
    fontWeight: 700,
    fontSize: "14px",
  },
  title: {
    margin: "12px 0 8px",
    fontSize: "34px",
    fontWeight: 900,
  },
  subtitle: {
    margin: "4px 0",
    color: "#64748b",
  },
  card: {
    background: "white",
    border: "1px solid #e5e7eb",
    borderRadius: "20px",
    padding: "24px",
    marginBottom: "20px",
    boxShadow: "0 10px 25px rgba(15,23,42,0.05)",
  },
  sectionTitle: {
    margin: "0 0 18px",
    fontSize: "22px",
    fontWeight: 900,
  },
  sourceGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
    gap: "16px",
  },
  sourceCard: {
    background: "#fff",
    borderRadius: "18px",
    padding: "18px",
    cursor: "pointer",
    textAlign: "left",
  },
  sourceTop: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: "12px",
    gap: "12px",
  },
  sourceMeta: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "10px",
    color: "#475569",
    fontSize: "13px",
  },
  badgeStack: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: "6px",
  },
  badge: {
    padding: "4px 10px",
    borderRadius: "999px",
    background: "#eef2ff",
    color: "#3730a3",
    fontSize: "12px",
    fontWeight: 800,
    whiteSpace: "nowrap",
  },
  verifiedBadge: {
    padding: "4px 10px",
    borderRadius: "999px",
    background: "#dcfce7",
    color: "#166534",
    fontSize: "12px",
    fontWeight: 900,
    whiteSpace: "nowrap",
    display: "inline-block",
  },
  unverifiedBadge: {
    padding: "4px 10px",
    borderRadius: "999px",
    background: "#ffedd5",
    color: "#9a3412",
    fontSize: "12px",
    fontWeight: 900,
    whiteSpace: "nowrap",
    display: "inline-block",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0,1fr))",
    gap: "16px",
    marginBottom: "20px",
  },
  statCard: {
    background: "white",
    border: "1px solid #e5e7eb",
    borderRadius: "18px",
    padding: "20px",
  },
  statLabel: {
    display: "block",
    color: "#64748b",
    fontSize: "13px",
    fontWeight: 800,
    marginBottom: "8px",
  },
  statValue: {
    fontSize: "24px",
    fontWeight: 900,
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "20px",
    alignItems: "flex-start",
    marginBottom: "20px",
  },
  muted: {
    margin: 0,
    color: "#64748b",
    fontSize: "14px",
  },
  evidenceGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "14px",
  },
  evidenceItem: {
    border: "1px solid #e5e7eb",
    background: "#f8fafc",
    borderRadius: "14px",
    padding: "14px",
    display: "grid",
    gap: "6px",
    overflowWrap: "anywhere",
  },
  evidenceLabel: {
    color: "#64748b",
    fontSize: "12px",
    fontWeight: 900,
    textTransform: "uppercase",
  },
  warningInline: {
    marginTop: "16px",
    padding: "14px",
    borderRadius: "14px",
    border: "1px solid #fed7aa",
    background: "#fff7ed",
    color: "#9a3412",
    fontWeight: 800,
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0,1fr))",
    gap: "14px",
  },
  mappingGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0,1fr))",
    gap: "14px",
  },
  label: {
    display: "grid",
    gap: "8px",
    fontWeight: 700,
    color: "#334155",
  },
  input: {
    border: "1px solid #cbd5e1",
    borderRadius: "12px",
    padding: "12px",
  },
  primaryButton: {
    border: "none",
    background: "#111827",
    color: "white",
    padding: "12px 18px",
    borderRadius: "12px",
    fontWeight: 800,
    cursor: "pointer",
  },
  secondaryButton: {
    border: "1px solid #cbd5e1",
    background: "white",
    color: "#111827",
    padding: "12px 18px",
    borderRadius: "12px",
    fontWeight: 800,
    cursor: "pointer",
  },
  disabledButton: {
    border: "1px solid #d1d5db",
    background: "#e5e7eb",
    color: "#6b7280",
    padding: "12px 18px",
    borderRadius: "12px",
    fontWeight: 900,
    cursor: "not-allowed",
  },
  tableWrap: {
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  th: {
    textAlign: "left",
    padding: "12px",
    borderBottom: "1px solid #e5e7eb",
    color: "#64748b",
    fontWeight: 800,
  },
  td: {
    padding: "12px",
    borderBottom: "1px solid #e5e7eb",
  },
  empty: {
    padding: "30px",
    textAlign: "center",
    color: "#64748b",
  },
  emptyBox: {
    padding: "18px",
    border: "1px dashed #cbd5e1",
    borderRadius: "14px",
    color: "#64748b",
    fontWeight: 700,
    marginBottom: "16px",
    background: "#f8fafc",
  },
  message: {
    background: "#eef6ff",
    border: "1px solid #bfdbfe",
    color: "#1e3a8a",
    padding: "14px",
    borderRadius: "14px",
    marginBottom: "20px",
    fontWeight: 700,
  },
  warningBox: {
    background: "#fff7ed",
    border: "1px solid #fed7aa",
    color: "#7c2d12",
    padding: "18px",
    borderRadius: "18px",
    marginBottom: "20px",
  },
  warningTitle: {
    margin: "0 0 8px",
    fontSize: "20px",
    fontWeight: 900,
  },
  warningText: {
    margin: 0,
    fontWeight: 700,
    lineHeight: 1.6,
  },
  lockBanner: {
    background: "#fffbeb",
    border: "1px solid #f59e0b",
    color: "#78350f",
    padding: "20px",
    borderRadius: "18px",
    marginBottom: "20px",
  },
  lockTitle: {
    margin: "0 0 8px",
    fontSize: "22px",
    fontWeight: 900,
  },
  lockText: {
    margin: 0,
    fontWeight: 700,
  },
  smallButton: {
    border: "1px solid #cbd5e1",
    background: "white",
    color: "#111827",
    borderRadius: "10px",
    padding: "6px 10px",
    fontWeight: 700,
    cursor: "pointer",
  },
  deleteButton: {
    border: "1px solid #fecaca",
    background: "#fef2f2",
    color: "#b91c1c",
    borderRadius: "10px",
    padding: "6px 10px",
    fontWeight: 700,
    cursor: "pointer",
  },
  deletedBadge: {
    background: "#e5e7eb",
    color: "#374151",
    borderRadius: "999px",
    padding: "6px 10px",
    fontSize: "12px",
    fontWeight: 800,
    display: "inline-block",
  },
  readyBadge: {
    background: "#dcfce7",
    color: "#166534",
    borderRadius: "999px",
    padding: "6px 10px",
    fontSize: "12px",
    fontWeight: 800,
    display: "inline-block",
  },
  duplicateBadge: {
    background: "#fef3c7",
    color: "#92400e",
    borderRadius: "999px",
    padding: "6px 10px",
    fontSize: "12px",
    fontWeight: 800,
    display: "inline-block",
  },
  issueText: {
    marginTop: "6px",
    color: "#64748b",
    fontSize: "12px",
    fontWeight: 700,
  },
  newTxBox: {
    marginBottom: "20px",
    display: "grid",
    gap: "16px",
  },
  importBox: {
    display: "grid",
    gap: "16px",
    marginBottom: "20px",
  },
  importInfo: {
    background: "#f8fafc",
    border: "1px solid #e5e7eb",
    borderRadius: "12px",
    padding: "12px",
    color: "#334155",
    fontWeight: 700,
  },
  csvStatsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0,1fr))",
    gap: "12px",
  },
  statMini: {
    background: "#f8fafc",
    border: "1px solid #e5e7eb",
    borderRadius: "12px",
    padding: "12px",
    fontWeight: 800,
    color: "#334155",
  },
  buttonRow: {
    display: "flex",
    gap: "12px",
    alignItems: "center",
  },
  checkboxLabel: {
    display: "flex",
    gap: "8px",
    alignItems: "center",
    color: "#334155",
    fontWeight: 800,
  },
  actionRow: {
    display: "flex",
    gap: "8px",
    alignItems: "center",
  },
};