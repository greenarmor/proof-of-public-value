const { execSync } = require("child_process");
const HOME = process.env.HOME;
const PATH = HOME + "/.local/bin:" + (process.env.PATH || "");
const opts = { env: { ...process.env, PATH }, encoding: "utf-8" };

function invoke(id, fn, args) {
  const cmd = HOME + "/.local/bin/stellar contract invoke --source alice --network testnet --id " + id + " -- " + fn + " " + args + " 2>&1 | tail -1";
  return execSync(cmd, opts).trim();
}

const PVO = "CD6Z5LHRUMBQI6JIJRXED3QOPSKBXESV2RDTCNR4XE2JXN2X4NCZYSF7";
const PI = "CCRICAAZXOXKD5ZKII32TTWIB3BJEXYWM55FEMUODP4CNRGMOIRNFQ2D";

console.log("=== Aggregating PVOs with on-time tracking ===");

const pvoCount = parseInt(invoke(PVO, "get_pvo_count", ""));
console.log("PVO count: " + pvoCount);

const depts = {};
for (let i = 1; i <= pvoCount; i++) {
  process.stdout.write(".");
  const data = invoke(PVO, "get_pvo", "--pvo_id " + i);
  if (!data.includes('"id"')) continue;

  const dept = (data.match(/"department":"([^"]+)"/) || [])[1];
  const score = parseInt((data.match(/"public_value_score":(\d+)/) || [])[1]) || 0;
  const budget = parseInt((data.match(/"total_budget":"(\d+)"/) || [])[1]) || 0;
  const status = (data.match(/"status":"([^"]+)"/) || [])[1];
  const deadline = parseInt((data.match(/"deadline":(\d+)/) || [])[1]) || 0;
  const updated = parseInt((data.match(/"updated_at":(\d+)/) || [])[1]) || 0;

  if (!depts[dept]) depts[dept] = { cnt: 0, score: 0, budget: 0, completed: 0, on_time: 0 };
  depts[dept].cnt++;
  depts[dept].score += score;
  depts[dept].budget += budget;
  if (status === "Completed") {
    depts[dept].completed++;
    if (deadline > 0 && updated <= deadline) depts[dept].on_time++;
  }
}
console.log(" done\n");

console.log("=== Submitting benchmarks ===");
for (const [dept, d] of Object.entries(depts)) {
  const avg = Math.floor(d.score / d.cnt);
  const onTimePct = d.completed > 0 ? Math.round(d.on_time * 100 / d.completed) : 0;

  const result = invoke(PI, "update_department_benchmark",
    '--department \'"' + dept + '"\' ' +
    '--avg_value_score ' + avg + " " +
    '--pvo_count ' + d.cnt + " " +
    '--total_budget ' + d.budget + " " +
    '--completed_projects ' + d.completed + " " +
    '--on_time_rate ' + onTimePct
  );
  console.log("  " + dept + ": score=" + avg + " completed=" + d.completed + "/" + d.cnt + " on-time=" + onTimePct + "%");
}

invoke(PI, "record_national_snapshot", "");
console.log("\n=== Snapshot recorded ===");
