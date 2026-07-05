const { execSync } = require("child_process");
const PATH = process.env.HOME + "/.local/bin:" + (process.env.PATH || "");
const opts = { env: { ...process.env, PATH }, encoding: "utf-8" };

function invoke(id, fn, args) {
  const cmd = `${HOME}/.local/bin/stellar contract invoke --source alice --network testnet --id ${id} -- ${fn} ${args} 2>&1 | tail -1`;
  return execSync(cmd, opts).trim();
}

const HOME = process.env.HOME;
const PVO_CORE = "CCWMZE527DTPNR4KVKTJMOUQ6A4ITKXNNO2NFDEVESMGCXZVWD6AZGE4";
const PI = "CCRICAAZXOXKD5ZKII32TTWIB3BJEXYWM55FEMUODP4CNRGMOIRNFQ2D";

console.log("=== Aggregating 51 PVOs ===");
const depts = {};

for (let i = 1; i <= 51; i++) {
  process.stdout.write(".");
  const data = invoke(PVO_CORE, "get_pvo", `--pvo_id ${i}`);
  if (!data.includes('"id"')) continue;
  const dept = (data.match(/"department":"([^"]+)"/) || [])[1];
  const score = parseInt((data.match(/"public_value_score":(\d+)/) || [])[1]) || 0;
  const budget = parseInt((data.match(/"total_budget":"(\d+)"/) || [])[1]) || 0;
  const status = (data.match(/"status":"([^"]+)"/) || [])[1];
  if (!depts[dept]) depts[dept] = { cnt: 0, score: 0, budget: 0, completed: 0 };
  depts[dept].cnt++;
  depts[dept].score += score;
  depts[dept].budget += budget;
  if (status === "Completed") depts[dept].completed++;
}
console.log(" done\n");

console.log("=== Submitting benchmarks ===");
for (const [dept, d] of Object.entries(depts)) {
  const avg = Math.floor(d.score / d.cnt);
  invoke(PI, "update_department_benchmark",
    `--department '"${dept}"' --avg_value_score ${avg} --pvo_count ${d.cnt} --total_budget ${d.budget} --completed_projects ${d.completed} --on_time_rate 0`);
  console.log(`  ${dept}: score=${avg}, pvos=${d.cnt}, completed=${d.completed}`);
}

invoke(PI, "record_national_snapshot", "");
console.log("\n=== Snapshot recorded ===");
