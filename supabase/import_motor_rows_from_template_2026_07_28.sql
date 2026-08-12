-- Motor policy import from motor_policy_import_template.xlsx - 2026-07-28
-- Source: Motor Import sheet, Excel rows 8 to 18.
-- Run this in Supabase SQL Editor.
--
-- Safety:
-- - This script skips a row if the same vehicle number + effective date already exists.
-- - It looks up insurer, motor insurance type, commission rate, and split pattern from Settings.
-- - It creates/updates clients and vehicles, then creates policy series, policy terms,
--   sum assured values, motor details, and commission rows.

create temporary table if not exists _motor_import_source (
  excel_row integer primary key,
  client_name text not null,
  client_type text,
  business_registration_no text,
  referral text,
  insurer text not null,
  policy_no text,
  effective_date date not null,
  expiry_date date not null,
  stage text,
  premium_status text,
  sum_assured numeric(14, 2),
  gross_premium numeric(14, 2) not null,
  total_premium numeric(14, 2),
  split_pattern text,
  vehicle_no text not null,
  motor_type text,
  type_of_cover text,
  ncd numeric(7, 6),
  make_model text,
  year_of_manufacture integer,
  engine_cc integer,
  engine_no text,
  chassis_no text,
  bdm numeric(14, 2),
  btm numeric(14, 2),
  extra_coverage text,
  motor_description text,
  notes text
) on commit drop;

create temporary table if not exists _motor_import_result (
  excel_row integer,
  client_name text,
  vehicle_no text,
  effective_date date,
  action text,
  policy_term_id uuid
) on commit drop;

truncate table _motor_import_source;
truncate table _motor_import_result;

insert into _motor_import_source (
  excel_row,
  client_name,
  client_type,
  business_registration_no,
  referral,
  insurer,
  policy_no,
  effective_date,
  expiry_date,
  stage,
  premium_status,
  sum_assured,
  gross_premium,
  total_premium,
  split_pattern,
  vehicle_no,
  motor_type,
  type_of_cover,
  ncd,
  make_model,
  year_of_manufacture,
  engine_cc,
  engine_no,
  chassis_no,
  bdm,
  btm,
  extra_coverage,
  motor_description,
  notes
)
values
  (8, 'Yun Hing Auto Parts', 'company', null, 'Bryan', 'Allianz', null, date '2026-01-19', date '2027-01-18', 'policy', 'unpaid', 83000, 929.53, 1013.90, 'Bryan', 'STA3113A', 'company', 'Comprehensive', null, 'TOYOTA HILUX G KUN25R-PRMSHEDH 4D DOUBLE CAB PICK-UP 4 SP AUTOMATIC CKD 2494 CC', 2018, null, '1GD0390967', 'PN1BA3CD203689690', null, null, null, null, null),
  (9, 'Ho Sie Khee', 'individual', null, 'Sonia', 'Tokio Marine', null, date '2026-01-25', date '2027-01-24', 'policy', 'unpaid', 72000, 252.75, 176.92, 'Hanhong', 'SJC6710', 'private', 'Comprehensive', null, 'Perodua Bezza 4WD Wagon', 2024, null, '2NR3B54448', 'PM2F850G002109937', null, null, null, null, null),
  (10, 'Siau Nyuk Teng', 'individual', null, 'Bryan', 'Allianz', null, date '2026-01-30', date '2027-01-29', 'policy', 'unpaid', 88000, 119.32, 83.52, 'Bryan', 'STA2080A', 'private', 'Comprehensive', null, 'Honda CR-V 1.5 TC 4WD RW 4D Wagon 1 SP Automatic Constantly Variable (CVT) CKD 1498 CC', 2018, null, 'L15BH7501775', 'PMHRW1830JD711836', null, null, null, null, null),
  (11, 'TLH Trading & Service Sdn Bhd', 'company', '202501037393', 'Chelsea', 'Allianz', null, date '2026-09-02', date '2027-08-02', 'policy', 'unpaid', 41000, 106.92, 74.84, 'H/C', 'QS2656B', 'company', 'Comprehensive', null, 'TOYOTA HILUX G VNT KUN26R 4D DOUBLE CAB PICK-UP 4 SP AUTOMATIC CKD 2982CC', 2013, null, '1KDU446090', 'MR0FZ29GX02529411', null, null, null, null, null),
  (12, 'Yun Hing Auto Parts', 'company', null, null, 'Etiqa General', null, date '2026-11-02', date '2027-10-02', 'policy', 'unpaid', 581500, 456.21, 319.34, 'Bryan', 'ST3113W', 'company', 'Comprehensive', null, 'Lexus LX600 3BA-VJA310W Recon', 2022, null, 'V35A0074867', 'VJA3104004261', null, null, null, null, null),
  (13, 'Ting Siew Haw', 'individual', null, 'Ting', 'Allianz', null, date '2026-11-03', date '2027-10-03', 'policy', 'unpaid', 77000, 91.26, 63.88, 'Hanhong', 'SYR8317', 'private', 'Comprehensive', null, 'ISUZU D-MAX STANDARD MT MY21 4D DOUBLE CAB PICK-UP 6 SP MANUAL CKD 1898 CC', 2021, null, 'RZ4EWX5446', 'MPATFS87JMT012821', null, null, null, null, null),
  (14, 'Leoalen Lee Zet Kai', 'individual', null, null, 'Allianz', null, date '2026-03-17', date '2027-03-16', 'policy', 'unpaid', 91000, 144.94, 101.46, 'Hanhong', 'SD6220X', 'private', 'Comprehensive', null, 'HONDA WR-V V MY23 DG4 4D WAGON 1 SP AUTOMATIC CONSTANTLY VARIABLE (CVT) CKD 1498 CC', 2025, null, 'L15ZF9005182', 'PMHDG4860PD825176', null, null, null, null, null),
  (15, 'Lai Mui Loon', 'individual', null, 'Bryan', 'Allianz', null, date '2026-03-24', date '2027-03-23', 'policy', 'unpaid', 68000, 77.20, 54.04, 'Bryan', 'SWG7828', 'private', 'Comprehensive', null, 'PERODUA ATIVA AV MY21 D55L 4D WAGON 1 SP AUTOMATIC CONSTANTLY VARIABLE (CVT) CKD 998 CC', 2023, null, '1KRU74A09G', 'PM2AA1AA00G067360', null, null, null, null, null),
  (16, 'Chin Hien Fu', 'individual', null, 'Rupert', 'Allianz', null, date '2026-03-26', date '2026-07-07', 'policy', 'unpaid', 10000, 5.00, 3.50, 'Hanhong', 'QME2142', 'private', 'Comprehensive', null, 'TOYOTA USHER LF-80R 4D WAGON 5 SP MANUAL CKD 2446 CC', 2000, null, '2L9578240', 'PN111LF8004000560', null, null, null, null, null),
  (17, 'Chin Hien Fu', 'individual', null, 'Rupert', 'Allianz', null, date '2026-03-26', date '2027-03-25', 'policy', 'unpaid', 35000, 36.82, 25.77, 'Hanhong', 'SAA128B', 'private', 'Comprehensive', null, 'PERODUA MYVI ADVANCE MY17 4D HATCHBACK 4 SP AUTOMATIC CONVENTIONAL CKD 1496 CC', 2018, null, '2NR0U10084', 'PM2M8065002009948', null, null, null, null, null),
  (18, 'Chin Hien Fu', 'individual', null, 'Rupert', 'Allianz', null, date '2026-03-27', date '2027-03-26', 'policy', 'unpaid', 23000, 29.73, 20.81, 'Hanhong', 'SAB128W', 'private', 'Comprehensive', null, 'TOYOTA PRIUS (HYBRID) ZVW30R-AHXEBW 4D HATCHBACK CONTINUOUS VARIABLE CBU 1798 CC', 2011, null, '22R5165978', 'JTDKN36U901428701', null, null, null, null, null);

do $$
declare
  source_row record;
  split_rule record;
  missing_values text;
  motor_type_id uuid;
  client_id_value uuid;
  insurer_id_value uuid;
  split_pattern_id_value uuid;
  rate_setting record;
  vehicle_id_value uuid;
  policy_series_id_value uuid;
  policy_term_id_value uuid;
  existing_policy_term_id uuid;
  vehicle_normalized text;
  resolved_client_type public.client_type;
  resolved_motor_type public.motor_type;
  net_percent numeric;
  equal_rule_count integer;
  total_net_commission_amount numeric;
  fixed_gross_premium_amount numeric;
  calculation_percent_value numeric;
  commission_amount_value numeric;
begin
  select id
  into motor_type_id
  from public.insurance_types
  where active = true
    and lower(code) = 'motor'
  limit 1;

  if motor_type_id is null then
    raise exception 'Import stopped: active Motor insurance type was not found in Settings.';
  end if;

  select string_agg(distinct s.insurer, ', ' order by s.insurer)
  into missing_values
  from _motor_import_source s
  left join public.insurers i
    on lower(trim(i.insurer_name)) = lower(trim(s.insurer))
  where i.id is null;

  if missing_values is not null then
    raise exception 'Import stopped: these insurers were not found in Settings: %', missing_values;
  end if;

  select string_agg(distinct s.split_pattern, ', ' order by s.split_pattern)
  into missing_values
  from _motor_import_source s
  left join public.commission_split_patterns csp
    on lower(trim(csp.code)) = lower(trim(s.split_pattern))
    or lower(trim(csp.name)) = lower(trim(s.split_pattern))
  where s.split_pattern is not null
    and csp.id is null;

  if missing_values is not null then
    raise exception 'Import stopped: these split patterns were not found in Settings: %', missing_values;
  end if;

  select id, gross_commission_percent, net_commission_percent
  into rate_setting
  from public.commission_rate_settings
  where insurance_type_id = motor_type_id
    and active = true
    and effective_to is null
  order by effective_from desc nulls last
  limit 1;

  if rate_setting.id is null then
    raise exception 'Import stopped: active Motor commission rate was not found in Settings.';
  end if;

  for source_row in
    select *
    from _motor_import_source
    order by excel_row
  loop
    vehicle_normalized := upper(regexp_replace(source_row.vehicle_no, '[^A-Za-z0-9]', '', 'g'));
    resolved_client_type := coalesce(source_row.client_type, 'individual')::public.client_type;
    resolved_motor_type := nullif(source_row.motor_type, '')::public.motor_type;

    select pt.id
    into existing_policy_term_id
    from public.policy_terms pt
    join public.motor_policy_details mpd on mpd.policy_term_id = pt.id
    where pt.effective_date = source_row.effective_date
      and upper(regexp_replace(coalesce(mpd.vehicle_no_snapshot, ''), '[^A-Za-z0-9]', '', 'g')) = vehicle_normalized
    limit 1;

    if existing_policy_term_id is not null then
      insert into _motor_import_result (
        excel_row,
        client_name,
        vehicle_no,
        effective_date,
        action,
        policy_term_id
      )
      values (
        source_row.excel_row,
        source_row.client_name,
        source_row.vehicle_no,
        source_row.effective_date,
        'skipped_existing_vehicle_effective_date',
        existing_policy_term_id
      );
      continue;
    end if;

    client_id_value := null;

    if source_row.business_registration_no is not null then
      select id
      into client_id_value
      from public.clients
      where business_registration_no = source_row.business_registration_no
      limit 1;
    end if;

    if client_id_value is null then
      select id
      into client_id_value
      from public.clients
      where lower(trim(client_name)) = lower(trim(source_row.client_name))
      order by created_at asc nulls last
      limit 1;
    end if;

    if client_id_value is null then
      insert into public.clients (
        client_name,
        business_registration_no,
        client_type,
        referral
      )
      values (
        source_row.client_name,
        source_row.business_registration_no,
        resolved_client_type,
        source_row.referral
      )
      returning id into client_id_value;
    else
      update public.clients
      set
        business_registration_no = coalesce(public.clients.business_registration_no, source_row.business_registration_no),
        client_type = coalesce(resolved_client_type, public.clients.client_type),
        referral = coalesce(public.clients.referral, source_row.referral)
      where id = client_id_value;
    end if;

    select id
    into insurer_id_value
    from public.insurers
    where lower(trim(insurer_name)) = lower(trim(source_row.insurer))
    limit 1;

    select id
    into split_pattern_id_value
    from public.commission_split_patterns
    where lower(trim(code)) = lower(trim(source_row.split_pattern))
       or lower(trim(name)) = lower(trim(source_row.split_pattern))
    limit 1;

    select id
    into vehicle_id_value
    from public.vehicles
    where vehicle_no_normalized = vehicle_normalized
    limit 1;

    if vehicle_id_value is null then
      insert into public.vehicles (
        vehicle_no,
        vehicle_no_normalized,
        make_model,
        year_of_manufacture,
        engine_cc,
        engine_no,
        chassis_no
      )
      values (
        upper(source_row.vehicle_no),
        vehicle_normalized,
        source_row.make_model,
        source_row.year_of_manufacture,
        source_row.engine_cc,
        source_row.engine_no,
        source_row.chassis_no
      )
      returning id into vehicle_id_value;
    else
      update public.vehicles
      set
        make_model = coalesce(source_row.make_model, public.vehicles.make_model),
        year_of_manufacture = coalesce(source_row.year_of_manufacture, public.vehicles.year_of_manufacture),
        engine_cc = coalesce(source_row.engine_cc, public.vehicles.engine_cc),
        engine_no = coalesce(source_row.engine_no, public.vehicles.engine_no),
        chassis_no = coalesce(source_row.chassis_no, public.vehicles.chassis_no)
      where id = vehicle_id_value;
    end if;

    insert into public.policy_series (
      client_id,
      insurance_type_id,
      series_name,
      primary_risk_label,
      status
    )
    values (
      client_id_value,
      motor_type_id,
      source_row.client_name || ' - Motor',
      upper(source_row.vehicle_no),
      'active'
    )
    returning id into policy_series_id_value;

    insert into public.policy_terms (
      policy_series_id,
      client_id,
      insurance_type_id,
      insurer_id,
      commission_rate_setting_id,
      split_pattern_id,
      policy_number,
      effective_date,
      expiry_date,
      primary_sum_assured,
      gross_premium,
      total_premium,
      gross_commission_percent,
      net_commission_percent,
      premium_status,
      term_stage,
      quotation_status,
      policy_status,
      renewal_status,
      insured_name_snapshot,
      notes
    )
    values (
      policy_series_id_value,
      client_id_value,
      motor_type_id,
      insurer_id_value,
      rate_setting.id,
      split_pattern_id_value,
      source_row.policy_no,
      source_row.effective_date,
      source_row.expiry_date,
      source_row.sum_assured,
      source_row.gross_premium,
      source_row.total_premium,
      rate_setting.gross_commission_percent,
      rate_setting.net_commission_percent,
      coalesce(source_row.premium_status, 'unpaid')::public.premium_status,
      coalesce(source_row.stage, 'policy')::public.term_stage,
      case
        when coalesce(source_row.stage, 'policy') = 'quotation'
          then 'draft'::public.quotation_status
        else null::public.quotation_status
      end,
      case
        when coalesce(source_row.stage, 'policy') = 'policy'
          then 'active'::public.policy_status
        else null::public.policy_status
      end,
      case
        when coalesce(source_row.stage, 'policy') = 'quotation'
          then 'quoting'::public.renewal_status
        else 'not_started'::public.renewal_status
      end,
      source_row.client_name,
      source_row.notes
    )
    returning id into policy_term_id_value;

    if source_row.sum_assured is not null then
      insert into public.policy_term_values (
        policy_term_id,
        value_type,
        amount,
        currency
      )
      values (
        policy_term_id_value,
        'sum_assured',
        source_row.sum_assured,
        'MYR'
      );
    end if;

    insert into public.motor_policy_details (
      policy_term_id,
      vehicle_id,
      motor_type,
      type_of_cover,
      vehicle_no_snapshot,
      ncd,
      extra_coverage,
      bdm,
      btm,
      motor_description
    )
    values (
      policy_term_id_value,
      vehicle_id_value,
      resolved_motor_type,
      source_row.type_of_cover,
      upper(source_row.vehicle_no),
      source_row.ncd,
      source_row.extra_coverage,
      source_row.bdm,
      source_row.btm,
      source_row.motor_description
    );

    if split_pattern_id_value is not null
      and source_row.gross_premium is not null
      and rate_setting.net_commission_percent is not null
    then
      net_percent := rate_setting.net_commission_percent;

      select greatest(count(*), 1)
      into equal_rule_count
      from public.commission_split_rules
      where split_pattern_id = split_pattern_id_value
        and rule_type = 'equal_net_share';

      total_net_commission_amount := source_row.gross_premium * net_percent;

      select coalesce(sum(source_row.gross_premium * coalesce(fixed_percent, 0)), 0)
      into fixed_gross_premium_amount
      from public.commission_split_rules
      where split_pattern_id = split_pattern_id_value
        and rule_type = 'fixed_percent_of_gross';

      for split_rule in
        select *
        from public.commission_split_rules
        where split_pattern_id = split_pattern_id_value
        order by sort_order asc
      loop
        calculation_percent_value := 0;
        commission_amount_value := 0;

        if split_rule.rule_type = 'net_commission_share' then
          calculation_percent_value := net_percent * coalesce(split_rule.share_percent, 0);
          commission_amount_value := source_row.gross_premium * calculation_percent_value;
        elsif split_rule.rule_type = 'fixed_percent_of_gross' then
          calculation_percent_value := coalesce(split_rule.fixed_percent, 0);
          commission_amount_value := source_row.gross_premium * calculation_percent_value;
        elsif split_rule.rule_type = 'remaining_net_after_fixed_percent' then
          commission_amount_value := greatest(total_net_commission_amount - fixed_gross_premium_amount, 0);
          calculation_percent_value := case
            when source_row.gross_premium > 0 then commission_amount_value / source_row.gross_premium
            else 0
          end;
        elsif split_rule.rule_type = 'equal_net_share' then
          calculation_percent_value := net_percent / equal_rule_count;
          commission_amount_value := source_row.gross_premium * calculation_percent_value;
        end if;

        commission_amount_value := round(commission_amount_value, 2);

        insert into public.commissions (
          policy_term_id,
          payee_id,
          split_pattern_id,
          auto_calculation_percent,
          auto_amount,
          calculation_percent,
          amount,
          unpaid_amount,
          is_custom,
          custom_reason,
          customized_at,
          status
        )
        values (
          policy_term_id_value,
          split_rule.payee_id,
          split_pattern_id_value,
          calculation_percent_value,
          commission_amount_value,
          calculation_percent_value,
          commission_amount_value,
          commission_amount_value,
          false,
          null,
          null,
          'unpaid'
        );
      end loop;
    end if;

    insert into _motor_import_result (
      excel_row,
      client_name,
      vehicle_no,
      effective_date,
      action,
      policy_term_id
    )
    values (
      source_row.excel_row,
      source_row.client_name,
      source_row.vehicle_no,
      source_row.effective_date,
      'inserted',
      policy_term_id_value
    );
  end loop;
end $$;

select
  excel_row,
  client_name,
  vehicle_no,
  effective_date,
  action,
  policy_term_id
from _motor_import_result
order by excel_row;
