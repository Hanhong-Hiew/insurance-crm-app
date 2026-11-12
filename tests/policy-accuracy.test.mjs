import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import vm from "node:vm";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const require=createRequire(import.meta.url);
const context={require,module:{exports:{}},process,console,setTimeout,clearTimeout,setInterval,clearInterval,performance,__filename:path.join(root,"node_modules/typescript/lib/typescript.js"),__dirname:path.join(root,"node_modules/typescript/lib")};
vm.runInNewContext(readFileSync(path.join(root,"node_modules/typescript/lib/typescript.js"),"utf8"),context);
const ts=context.ts;
const modules=new Map();
function loadTs(relative) {
  if(modules.has(relative)) return modules.get(relative);
  const source=readFileSync(path.join(root,relative),"utf8");
  const result=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}});
  const module={exports:{}};
  const localRequire=(id)=>id.startsWith(".")?loadTs(path.posix.normalize(path.posix.join(path.posix.dirname(relative),id+".ts"))):require(id);
  new Function("require","module","exports",result.outputText)(localRequire,module,module.exports);
  modules.set(relative,module.exports); return module.exports;
}
const {formatPercent}=loadTs("lib/format.ts");
const {changedPolicyValues}=loadTs("lib/policy-field-changes.ts");
assert.deepEqual(changedPolicyValues({gross_premium:2000},{gross_premium:2050}),{gross_premium:2050});
const {totalPayable,premiumWarnings,nullableNumber}=loadTs("lib/policy-accuracy.ts");
const {calculateCommissionRows}=loadTs("lib/commission.ts");
const zeroRows=calculateCommissionRows({grossPremium:0,netCommissionPercent:0.07,rules:[{payee_id:"hh",rule_type:"remaining_net_after_fixed_percent"},{payee_id:"chelsea",rule_type:"fixed_percent_of_gross",fixed_percent:0.03}]});
assert.equal(zeroRows.length,2);
assert.equal(zeroRows[0].amount,0);
assert(Math.abs(zeroRows[0].calculation_percent-0.04)<1e-10);
assert.equal(formatPercent(0),"0%");
assert.equal(formatPercent("0"),"0%");
assert.equal(formatPercent(null),"-");
assert.equal(formatPercent(0.055),"5.5%");
assert.equal(nullableNumber("0"),0);
assert.equal(totalPayable("350.55","28.04","8"),386.59);
assert.equal(totalPayable(null,0,0),null);
assert.equal(premiumWarnings({gross:350.55,total:386.60,serviceTax:28.04,stampDuty:8,sumInsured:null,typicalRatePercent:null}).length,0);
assert.equal(premiumWarnings({gross:100,total:200,serviceTax:0,stampDuty:0,sumInsured:100000,typicalRatePercent:1}).length,2);
console.log("PASS: zero percentages, currency precision, rounding overrides and missing-digit warnings");

if(!process.env.KOVER_PGLITE_MODULE) {
  console.log("Set KOVER_PGLITE_MODULE to run the isolated PostgreSQL migration tests.");
  process.exit(0);
}
const {PGlite}=await import(process.env.KOVER_PGLITE_MODULE);
const db=new PGlite();
await db.waitReady;
const scalar=async(sql,params=[]) => (await db.query(sql,params)).rows[0];
try {
await db.exec(`
 create role anon; create role authenticated;
 create schema auth;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
 create type public.policy_status as enum('active','expired','renewed','lost','cancelled');
 create type public.term_stage as enum('quotation','policy');
 create type public.quotation_status as enum('draft','sent','awaiting_client','accepted','rejected');
 create type public.commission_status as enum('unpaid','paid');
 create type public.commission_rule_type as enum('gross_commission_share','net_commission_share','fixed_percent_of_gross','remaining_net_after_fixed_percent','equal_net_share');
 create table public.clients(id uuid primary key default gen_random_uuid(),client_name text);
 create table public.insurance_types(id uuid primary key default gen_random_uuid(),code text);
 create table public.commission_payees(id uuid primary key default gen_random_uuid(),name text);
 create table public.commission_split_patterns(id uuid primary key default gen_random_uuid(),code text);
 create table public.commission_split_rules(id uuid primary key default gen_random_uuid(),split_pattern_id uuid,payee_id uuid,rule_type public.commission_rule_type,share_percent numeric,fixed_percent numeric,subtract_percent numeric,sort_order integer);
 create table public.policy_terms(id uuid primary key default gen_random_uuid(),client_id uuid,insurance_type_id uuid,policy_number text,effective_date date,expiry_date date,primary_sum_assured numeric(14,2),gross_premium numeric(14,2) check(gross_premium>=0),total_premium numeric(14,2) check(total_premium>=0),gross_commission_percent numeric,net_commission_percent numeric,split_pattern_id uuid,policy_status public.policy_status,term_stage public.term_stage,quotation_status public.quotation_status,notes text);
 create table public.vehicles(id uuid primary key default gen_random_uuid(),vehicle_no text);
 create table public.motor_policy_details(id uuid primary key default gen_random_uuid(),policy_term_id uuid,vehicle_id uuid,vehicle_no_snapshot text,ncd numeric);
 create table public.commissions(id uuid primary key default gen_random_uuid(),policy_term_id uuid,payee_id uuid,split_pattern_id uuid,calculation_percent numeric,amount numeric(14,2),unpaid_amount numeric(14,2),status public.commission_status,paid_date date,auto_calculation_percent numeric,auto_amount numeric(14,2),is_custom boolean,custom_reason text,customized_at timestamptz);
 create view public.main_policy_view as select t.id as policy_term_id,t.client_id,t.policy_number,t.gross_premium,t.total_premium,m.ncd from public.policy_terms t left join public.motor_policy_details m on m.policy_term_id=t.id;
 insert into clients(id,client_name) values('10000000-0000-0000-0000-000000000001','Legacy Motor Client');
 insert into insurance_types(id,code) values('20000000-0000-0000-0000-000000000001','motor');
 insert into commission_payees(id,name) values('30000000-0000-0000-0000-000000000001','Hanhong'),('30000000-0000-0000-0000-000000000002','Chelsea');
 insert into commission_split_patterns(id,code) values('40000000-0000-0000-0000-000000000001','H/C');
 insert into commission_split_rules(split_pattern_id,payee_id,rule_type,fixed_percent,sort_order) values
 ('40000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000002','fixed_percent_of_gross',0.03,1),
 ('40000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','remaining_net_after_fixed_percent',null,2);
 insert into policy_terms(id,client_id,insurance_type_id,policy_number,effective_date,expiry_date,primary_sum_assured,gross_premium,total_premium,gross_commission_percent,net_commission_percent,split_pattern_id,policy_status,term_stage)
 values('50000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','LEGACY-1','2026-01-01','2026-12-31',100000,1000,1090,0.10,0.07,'40000000-0000-0000-0000-000000000001','active','policy');
 insert into vehicles(id,vehicle_no) values('60000000-0000-0000-0000-000000000001','ABC123');
 insert into motor_policy_details(policy_term_id,vehicle_id,vehicle_no_snapshot,ncd) values('50000000-0000-0000-0000-000000000001','60000000-0000-0000-0000-000000000001','ABC 123',0);
 insert into commissions(policy_term_id,payee_id,calculation_percent,amount,unpaid_amount,status,paid_date,is_custom) values
 ('50000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001',0.04,40,40,'unpaid',null,false),
 ('50000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000002',0.03,30,0,'paid','2026-01-02',false);
`);
const id="50000000-0000-0000-0000-000000000001";
const before=await scalar("select row_to_json(v) as data from main_policy_view v");
const oldColumns=(await db.query("select column_name from information_schema.columns where table_name='policy_terms'")).rows.map(r=>r.column_name);
const paidBefore=await scalar("select row_to_json(c) as data from commissions c where status='paid'");
const migration=readFileSync(path.join(root,"supabase/policy_accuracy_endorsements_2026_11_11.sql"),"utf8");
await db.exec(migration);
await db.exec(migration);
const after=await scalar("select row_to_json(v) as data from main_policy_view v");
for(const [key,value] of Object.entries(before.data)) assert.deepEqual(after.data[key],value);
assert.equal(after.data.issue_date,null);
const newColumns=(await db.query("select column_name,is_nullable from information_schema.columns where table_name='policy_terms'")).rows.filter(r=>!oldColumns.includes(r.column_name));
assert(newColumns.every(c=>c.is_nullable==="YES"));
assert.equal((await scalar("select count(*)::int as n from policy_change_history")).n,0);
console.log("PASS: migration and rerun preserve every legacy value, view column and paid row; all added policy columns nullable");
const save=(changes,choice=null)=>db.query("select kover_save_policy_financials($1,$2::jsonb,$3)",[id,JSON.stringify(changes),choice]);
await assert.rejects(save({gross_premium:1200}),/Choose whether/);
assert.equal(Number((await scalar("select gross_premium from policy_terms")).gross_premium),1000);
await save({gross_premium:1200},"keep");
assert.equal(Number((await scalar("select amount from commissions where status='unpaid'")).amount),40);
await save({gross_premium:2000},"update");
assert.equal(Number((await scalar("select amount from commissions where status='unpaid'")).amount),80);
assert.deepEqual((await scalar("select row_to_json(c) as data from commissions c where status='paid'")).data,paidBefore.data);
console.log("PASS: explicit update/keep, Hanhong 4% of gross and unchanged paid Chelsea commission");
const endorse=(endorsement,values,choice=null)=>db.query("select kover_save_endorsement($1,$2,$3::jsonb,$4) as id",[id,endorsement,JSON.stringify(values),choice]);
const values={endorsement_number:"END-1",issue_date:"2026-02-01",effective_date:"2026-02-01",description:"Additional cover",premium_change:100,service_tax_change:8,net_amount:108,settlement_status:"pending"};
await assert.rejects(endorse(null,values),/Choose whether/);
assert.equal((await scalar("select count(*)::int as n from policy_endorsements")).n,0);
const e1=(await endorse(null,values,"update")).rows[0].id;
await endorse(null,{...values,endorsement_number:"END-2",premium_change:-50,service_tax_change:-4,net_amount:-54},"keep");
const premiums=await scalar("select gross_premium,total_premium,original_gross_premium,original_total_premium from policy_terms");
assert.equal(Number(premiums.gross_premium),2050);
assert.equal(Number(premiums.total_premium),1144);
assert.equal(Number(premiums.original_gross_premium),2000);
assert.equal(Number(premiums.original_total_premium),1090);
await assert.rejects(save({gross_premium:null},"keep"),/cannot be cleared/);
await assert.rejects(save({total_premium:null},"keep"),/cannot be cleared/);
await save({gross_premium:2500},"update");
assert.equal(Number((await scalar("select gross_premium from policy_terms")).gross_premium),2550);
await endorse(e1,{...values,description:"Updated description",settlement_status:"pending"},"keep");
const history=(await db.query("select old_value,new_value from policy_change_history where field_name='endorsement' and old_value is not null")).rows;
assert(history.some(row=>row.old_value.description==="Additional cover" && row.new_value.values.description==="Updated description"));
await endorse(e1,{...values,settlement_status:"settled"},"keep");
await assert.rejects(endorse(e1,{...values,premium_change:200,net_amount:208,settlement_status:"settled"},"update"),/settled/);
console.log("PASS: signed endorsements, original/current separation, transactional rollback and settled protection");
await save({policy_status:"cancelled",cancellation_date:"2026-06-01",refund_amount:540,gross_refund_amount:500},"keep");
const clawbacks=(await db.query("select p.name,c.amount from policy_commission_clawbacks c join commission_payees p on p.id=c.payee_id order by p.name")).rows;
assert.equal(Number(clawbacks.find(r=>r.name==="Chelsea").amount),15);
assert.equal(Number(clawbacks.find(r=>r.name==="Hanhong").amount),20);
assert.deepEqual((await scalar("select row_to_json(c) as data from commissions c where status='paid'")).data,paidBefore.data);
await db.exec("update motor_policy_details set ncd=0.55; update motor_policy_details set ncd=0;");
assert((await scalar("select count(*)::int as n from policy_change_history where field_name='ncd'")).n===2);
assert((await scalar("select count(*)::int as n from policy_change_history where field_name='gross_premium'")).n>=4);
console.log("PASS: gross-refund clawbacks stored separately, paid rows unchanged, automatic NCD/premium history");
const dup=(await db.query("select * from kover_policy_duplicate_warnings(null,'abc-123','2026-06-01','2027-01-01',null,null)")).rows;
assert.equal(dup.length,1);
assert.match(dup[0].reason,/overlapping/);
assert.equal((await db.query("select * from kover_policy_duplicate_warnings($1,'ABC123','2026-06-01','2027-01-01','LEGACY-1',null)",[id])).rows.length,0);
await save({cover_note_number:"CN-0001"},"keep");
assert.equal((await db.query("select * from kover_policy_duplicate_warnings(null,null,null,null,'CN-0001',null)")).rows.length,1);
assert.equal((await db.query("select * from kover_motor_transfer_candidates('ABC 123',null)")).rows.length,1);
await db.exec("insert into policy_terms(id,client_id,policy_number,effective_date,expiry_date) values('50000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','SNAPSHOT-ONLY','2026-01-01','2026-12-31'); insert into motor_policy_details(policy_term_id,vehicle_no_snapshot) values('50000000-0000-0000-0000-000000000002','DEF456');");
assert.equal((await db.query("select * from kover_policy_duplicate_warnings(null,'DEF456','2026-06-01','2026-07-01',null,null)")).rows.length,1);
assert.equal((await db.query("select * from kover_motor_transfer_candidates('DEF456',null)")).rows.length,1);
console.log("PASS: normalized plate overlap, snapshot-only plates, self-exclusion, cross policy/cover-note duplicates and transfer lookup");
await db.exec("select set_config('request.jwt.claim.sub','',false)");
await assert.rejects(save({gross_premium:3000},"update"),/logged in/);
console.log("PASS: financial mutations reject signed-out requests");
} catch (error) {
  console.error({message:error.message,detail:error.detail,hint:error.hint,position:error.position,where:error.where});
  process.exitCode=1;
} finally { await db.close(); }
