import { PrismaClient, ContentType } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding WHAI Intelligence Hub...')

  // ─── REGIONS ─────────────────────────────────────────────────────────────
  console.log('→ Seeding regions...')
  const northAmerica = await prisma.region.upsert({
    where: { slug: 'north-america' },
    update: {},
    create: { name: 'North America', slug: 'north-america' },
  })
  const europe = await prisma.region.upsert({
    where: { slug: 'europe' },
    update: {},
    create: { name: 'Europe', slug: 'europe' },
  })
  const asiaPacific = await prisma.region.upsert({
    where: { slug: 'asia-pacific' },
    update: {},
    create: { name: 'Asia-Pacific', slug: 'asia-pacific' },
  })
  const middleEast = await prisma.region.upsert({
    where: { slug: 'middle-east-africa' },
    update: {},
    create: { name: 'Middle East & Africa', slug: 'middle-east-africa' },
  })
  const latinAmerica = await prisma.region.upsert({
    where: { slug: 'latin-america' },
    update: {},
    create: { name: 'Latin America', slug: 'latin-america' },
  })

  // Country-level regions
  const regionChildren = [
    { name: 'United States', slug: 'us', parent_id: northAmerica.id },
    { name: 'Canada', slug: 'canada', parent_id: northAmerica.id },
    { name: 'United Kingdom', slug: 'uk', parent_id: europe.id },
    { name: 'Germany', slug: 'germany', parent_id: europe.id },
    { name: 'France', slug: 'france', parent_id: europe.id },
    { name: 'Switzerland', slug: 'switzerland', parent_id: europe.id },
    { name: 'Netherlands', slug: 'netherlands', parent_id: europe.id },
    { name: 'Sweden', slug: 'sweden', parent_id: europe.id },
    { name: 'Denmark', slug: 'denmark', parent_id: europe.id },
    { name: 'Japan', slug: 'japan', parent_id: asiaPacific.id },
    { name: 'China', slug: 'china', parent_id: asiaPacific.id },
    { name: 'Australia', slug: 'australia', parent_id: asiaPacific.id },
    { name: 'Singapore', slug: 'singapore', parent_id: asiaPacific.id },
    { name: 'India', slug: 'india', parent_id: asiaPacific.id },
    { name: 'UAE', slug: 'uae', parent_id: middleEast.id },
    { name: 'Israel', slug: 'israel', parent_id: middleEast.id },
    { name: 'Brazil', slug: 'brazil', parent_id: latinAmerica.id },
    { name: 'Mexico', slug: 'mexico', parent_id: latinAmerica.id },
  ]
  const regionMap: Record<string, string> = {
    'north-america': northAmerica.id,
    'europe': europe.id,
    'asia-pacific': asiaPacific.id,
    'middle-east-africa': middleEast.id,
    'latin-america': latinAmerica.id,
  }
  for (const r of regionChildren) {
    const created = await prisma.region.upsert({
      where: { slug: r.slug },
      update: {},
      create: r,
    })
    regionMap[r.slug] = created.id
  }

  // ─── HEALTHCARE VERTICALS ────────────────────────────────────────────────
  console.log('→ Seeding healthcare verticals...')
  const parentVerticals = [
    { name: 'Digital Health & Health IT', slug: 'digital-health', sort_order: 1 },
    { name: 'Artificial Intelligence & ML in Healthcare', slug: 'ai-ml-healthcare', sort_order: 2 },
    { name: 'Pharmaceuticals & Biotech', slug: 'pharma-biotech', sort_order: 3 },
    { name: 'Medical Devices & Diagnostics', slug: 'medtech-diagnostics', sort_order: 4 },
    { name: 'Healthcare Services & Delivery', slug: 'healthcare-services', sort_order: 5 },
    { name: 'Life Sciences Tools & Services', slug: 'life-sciences-tools', sort_order: 6 },
    { name: 'Payer & Insurance', slug: 'payer-insurance', sort_order: 7 },
    { name: 'Healthcare Consulting & Advisory', slug: 'healthcare-consulting', sort_order: 8 },
    { name: 'Healthcare Private Equity & Venture Capital', slug: 'healthcare-pe-vc', sort_order: 9 },
    { name: 'Government / NHS / Public Health', slug: 'government-public-health', sort_order: 10 },
  ]

  const verticalMap: Record<string, string> = {}
  for (const v of parentVerticals) {
    const created = await prisma.healthcareVertical.upsert({
      where: { slug: v.slug },
      update: {},
      create: { ...v, parent_id: null },
    })
    verticalMap[v.slug] = created.id
  }

  const childVerticals = [
    // Digital Health
    { name: 'Electronic Health Records (EHR/EMR)', slug: 'ehr-emr', parent: 'digital-health', sort_order: 1 },
    { name: 'Telemedicine & Virtual Care', slug: 'telemedicine', parent: 'digital-health', sort_order: 2 },
    { name: 'Remote Patient Monitoring', slug: 'remote-monitoring', parent: 'digital-health', sort_order: 3 },
    { name: 'Clinical Decision Support', slug: 'clinical-decision-support', parent: 'digital-health', sort_order: 4 },
    { name: 'Health Information Exchange (HIE)', slug: 'hie', parent: 'digital-health', sort_order: 5 },
    { name: 'Revenue Cycle Management', slug: 'revenue-cycle', parent: 'digital-health', sort_order: 6 },
    { name: 'Population Health Management', slug: 'population-health', parent: 'digital-health', sort_order: 7 },
    // AI/ML
    { name: 'Clinical AI / Diagnostic AI', slug: 'clinical-ai', parent: 'ai-ml-healthcare', sort_order: 1 },
    { name: 'Drug Discovery AI', slug: 'drug-discovery-ai', parent: 'ai-ml-healthcare', sort_order: 2 },
    { name: 'Medical Imaging AI', slug: 'medical-imaging-ai', parent: 'ai-ml-healthcare', sort_order: 3 },
    { name: 'NLP for Clinical Data', slug: 'nlp-clinical', parent: 'ai-ml-healthcare', sort_order: 4 },
    { name: 'Predictive Analytics', slug: 'predictive-analytics', parent: 'ai-ml-healthcare', sort_order: 5 },
    { name: 'Agentic AI in Healthcare', slug: 'agentic-ai', parent: 'ai-ml-healthcare', sort_order: 6 },
    { name: 'Generative AI in Healthcare', slug: 'generative-ai', parent: 'ai-ml-healthcare', sort_order: 7 },
    // Pharma/Biotech
    { name: 'Large Pharma', slug: 'large-pharma', parent: 'pharma-biotech', sort_order: 1 },
    { name: 'Specialty Pharma', slug: 'specialty-pharma', parent: 'pharma-biotech', sort_order: 2 },
    { name: 'Generic / Biosimilars', slug: 'generic-biosimilars', parent: 'pharma-biotech', sort_order: 3 },
    { name: 'Biotech (Pre-clinical)', slug: 'biotech-preclinical', parent: 'pharma-biotech', sort_order: 4 },
    { name: 'Biotech (Clinical Stage)', slug: 'biotech-clinical', parent: 'pharma-biotech', sort_order: 5 },
    { name: 'Contract Research Organisations (CROs)', slug: 'cro', parent: 'pharma-biotech', sort_order: 6 },
    { name: 'Contract Development & Manufacturing (CDMOs)', slug: 'cdmo', parent: 'pharma-biotech', sort_order: 7 },
    // MedTech
    { name: 'In Vitro Diagnostics (IVD)', slug: 'ivd', parent: 'medtech-diagnostics', sort_order: 1 },
    { name: 'Surgical Robotics', slug: 'surgical-robotics', parent: 'medtech-diagnostics', sort_order: 2 },
    { name: 'Wearables & Biosensors', slug: 'wearables', parent: 'medtech-diagnostics', sort_order: 3 },
    { name: 'Point-of-Care Diagnostics', slug: 'poc-diagnostics', parent: 'medtech-diagnostics', sort_order: 4 },
    { name: 'Imaging Equipment', slug: 'imaging-equipment', parent: 'medtech-diagnostics', sort_order: 5 },
    { name: 'Implantable Devices', slug: 'implantables', parent: 'medtech-diagnostics', sort_order: 6 },
    // Services
    { name: 'Hospitals & Health Systems', slug: 'hospitals', parent: 'healthcare-services', sort_order: 1 },
    { name: 'Ambulatory / Outpatient Care', slug: 'ambulatory', parent: 'healthcare-services', sort_order: 2 },
    { name: 'Home Health & Post-Acute', slug: 'home-health', parent: 'healthcare-services', sort_order: 3 },
    { name: 'Behavioural Health', slug: 'behavioural-health', parent: 'healthcare-services', sort_order: 4 },
    { name: 'Value-Based Care Organisations', slug: 'value-based-care', parent: 'healthcare-services', sort_order: 5 },
    // Life Sciences Tools
    { name: 'Genomics & Precision Medicine', slug: 'genomics', parent: 'life-sciences-tools', sort_order: 1 },
    { name: 'Clinical Trials & eClinical', slug: 'clinical-trials', parent: 'life-sciences-tools', sort_order: 2 },
    { name: 'Real-World Evidence (RWE)', slug: 'rwe', parent: 'life-sciences-tools', sort_order: 3 },
    { name: 'Regulatory & Compliance Technology', slug: 'reg-tech', parent: 'life-sciences-tools', sort_order: 4 },
    // Payer
    { name: 'Health Insurance / Managed Care', slug: 'health-insurance', parent: 'payer-insurance', sort_order: 1 },
    { name: 'Insurtech (Health)', slug: 'health-insurtech', parent: 'payer-insurance', sort_order: 2 },
    { name: 'Prior Authorisation Tech', slug: 'prior-auth', parent: 'payer-insurance', sort_order: 3 },
  ]

  for (const v of childVerticals) {
    const created = await prisma.healthcareVertical.upsert({
      where: { slug: v.slug },
      update: {},
      create: {
        name: v.name,
        slug: v.slug,
        sort_order: v.sort_order,
        parent_id: verticalMap[v.parent],
      },
    })
    verticalMap[v.slug] = created.id
  }

  // ─── THERAPEUTIC AREAS ───────────────────────────────────────────────────
  console.log('→ Seeding therapeutic areas...')
  const therapeuticAreasList = [
    'Oncology', 'Cardiovascular', 'Neurology / CNS', 'Immunology / Autoimmune',
    'Rare Diseases / Orphan Drugs', 'Infectious Disease', 'Metabolic / Diabetes / Obesity',
    'Respiratory', 'Gastroenterology', 'Dermatology', 'Ophthalmology',
    'Musculoskeletal / Orthopaedics', 'Women\'s Health', 'Paediatrics',
    'Mental Health / Psychiatry', 'Nephrology / Renal', 'Haematology',
    'Gene Therapy / Cell Therapy', 'Vaccines', 'Pain Management',
  ]
  const taMap: Record<string, string> = {}
  for (let i = 0; i < therapeuticAreasList.length; i++) {
    const name = therapeuticAreasList[i]
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    const ta = await prisma.therapeuticArea.upsert({
      where: { slug },
      update: {},
      create: { name, slug, sort_order: i + 1 },
    })
    taMap[slug] = ta.id
    taMap[name] = ta.id
  }

  // ─── JOB FUNCTIONS ───────────────────────────────────────────────────────
  console.log('→ Seeding job functions...')
  const jobFunctionsList = [
    'Clinical / Medical Affairs', 'Research & Development', 'Data Science / AI / Machine Learning',
    'Information Technology', 'Digital Health / Innovation', 'Regulatory Affairs',
    'Quality Assurance', 'Commercial / Sales', 'Marketing',
    'Business Development / Partnerships', 'Strategy / Corporate Development', 'Operations',
    'Supply Chain / Manufacturing', 'Finance / Accounting', 'Legal / Compliance',
    'Human Resources', 'Government Affairs / Policy', 'Investor Relations',
    'Procurement', 'Patient Engagement / Experience',
  ]
  const jfMap: Record<string, string> = {}
  for (let i = 0; i < jobFunctionsList.length; i++) {
    const name = jobFunctionsList[i]
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    const jf = await prisma.jobFunction.upsert({
      where: { slug },
      update: {},
      create: { name, slug, sort_order: i + 1 },
    })
    jfMap[slug] = jf.id
    jfMap[name] = jf.id
  }


  // ─── COMPANIES ───────────────────────────────────────────────────────────
  console.log('→ Seeding companies...')

  const companyData = [
    // PHARMA / BIOTECH (10)
    {
      name: 'NovaMedica Therapeutics', company_type: 'PHARMA' as const, ownership_status: 'PUBLIC' as const,
      founded_year: 1985, employee_count_range: 'RANGE_10000_PLUS' as const, annual_revenue_range: 'ABOVE_1B' as const,
      headquarters_country: 'United States', headquarters_city: 'Cambridge', headquarters_state_province: 'MA',
      website: 'https://novamedica.com', stock_ticker: 'NVMD', stock_exchange: 'NASDAQ',
      description: 'Leading biopharmaceutical company focused on oncology and immunology with a pipeline of over 30 compounds.',
      tags: ['oncology', 'immunology', 'kol-partner'], source: 'seed',
      verticals: ['large-pharma', 'biotech-clinical'], tas: ['Oncology', 'Immunology / Autoimmune'],
    },
    {
      name: 'Axiom Biosciences', company_type: 'BIOTECH' as const, ownership_status: 'VC_BACKED' as const,
      founded_year: 2018, employee_count_range: 'RANGE_51_200' as const, annual_revenue_range: 'LESS_THAN_1M' as const,
      headquarters_country: 'United States', headquarters_city: 'Boston', headquarters_state_province: 'MA',
      website: 'https://axiombio.com',
      description: 'AI-first drug discovery biotech using generative models to identify novel oncology targets.',
      tags: ['ai-drug-discovery', 'series-b'], source: 'seed',
      verticals: ['drug-discovery-ai', 'biotech-preclinical'], tas: ['Oncology', 'Gene Therapy / Cell Therapy'],
    },
    {
      name: 'Helix Pharma Group', company_type: 'PHARMA' as const, ownership_status: 'PUBLIC' as const,
      founded_year: 1972, employee_count_range: 'RANGE_5001_10000' as const, annual_revenue_range: 'RANGE_500M_1B' as const,
      headquarters_country: 'United Kingdom', headquarters_city: 'London',
      website: 'https://helixpharma.co.uk', stock_ticker: 'HLX', stock_exchange: 'LSE',
      description: 'UK-based specialty pharma company with strong CNS and cardiovascular portfolios.',
      tags: ['specialty-pharma', 'ftse100'], source: 'seed',
      verticals: ['specialty-pharma'], tas: ['Cardiovascular', 'Neurology / CNS'],
    },
    {
      name: 'Vericel Genomics', company_type: 'BIOTECH' as const, ownership_status: 'VC_BACKED' as const,
      founded_year: 2020, employee_count_range: 'RANGE_11_50' as const, annual_revenue_range: 'LESS_THAN_1M' as const,
      headquarters_country: 'United States', headquarters_city: 'San Francisco', headquarters_state_province: 'CA',
      website: 'https://vericelgenomics.com',
      description: 'Precision medicine startup developing CRISPR-based therapies for rare genetic diseases.',
      tags: ['crispr', 'rare-disease', 'seed-stage'], source: 'seed',
      verticals: ['genomics', 'biotech-preclinical'], tas: ['Rare Diseases / Orphan Drugs', 'Gene Therapy / Cell Therapy'],
    },
    {
      name: 'MedSynth Biologics', company_type: 'PHARMA' as const, ownership_status: 'PE_BACKED' as const,
      founded_year: 2005, employee_count_range: 'RANGE_1001_5000' as const, annual_revenue_range: 'RANGE_100_500M' as const,
      headquarters_country: 'Germany', headquarters_city: 'Munich',
      website: 'https://medsynth.de',
      description: 'Biosimilars and biologics manufacturer focused on affordable access in European and emerging markets.',
      tags: ['biosimilars', 'emerging-markets'], source: 'seed',
      verticals: ['generic-biosimilars'], tas: ['Immunology / Autoimmune', 'Oncology'],
    },
    {
      name: 'CytaPath Therapeutics', company_type: 'BIOTECH' as const, ownership_status: 'PUBLIC' as const,
      founded_year: 2012, employee_count_range: 'RANGE_201_500' as const, annual_revenue_range: 'RANGE_10_50M' as const,
      headquarters_country: 'United States', headquarters_city: 'San Diego', headquarters_state_province: 'CA',
      website: 'https://cytapath.com', stock_ticker: 'CYTP', stock_exchange: 'NASDAQ',
      description: 'Clinical-stage biotech developing CAR-T cell therapies for haematological malignancies.',
      tags: ['car-t', 'haematology', 'clinical-stage'], source: 'seed',
      verticals: ['biotech-clinical'], tas: ['Haematology', 'Oncology'],
    },
    {
      name: 'Pangolin Pharma', company_type: 'PHARMA' as const, ownership_status: 'PRIVATE' as const,
      founded_year: 1998, employee_count_range: 'RANGE_1001_5000' as const, annual_revenue_range: 'RANGE_100_500M' as const,
      headquarters_country: 'Switzerland', headquarters_city: 'Basel',
      website: 'https://pangolin.ch',
      description: 'Private Swiss specialty pharma with a focus on respiratory and metabolic diseases.',
      tags: ['respiratory', 'metabolic', 'swiss'], source: 'seed',
      verticals: ['specialty-pharma'], tas: ['Respiratory', 'Metabolic / Diabetes / Obesity'],
    },
    {
      name: 'OncoBridge Sciences', company_type: 'BIOTECH' as const, ownership_status: 'VC_BACKED' as const,
      founded_year: 2016, employee_count_range: 'RANGE_51_200' as const, annual_revenue_range: 'RANGE_1_10M' as const,
      headquarters_country: 'United States', headquarters_city: 'Houston', headquarters_state_province: 'TX',
      website: 'https://oncobridge.com',
      description: 'Developing ADC (antibody-drug conjugate) therapies targeting solid tumours.',
      tags: ['adc', 'oncology', 'series-c'], source: 'seed',
      verticals: ['biotech-clinical'], tas: ['Oncology'],
    },
    {
      name: 'Meridian Biopharma', company_type: 'PHARMA' as const, ownership_status: 'PUBLIC' as const,
      founded_year: 1990, employee_count_range: 'RANGE_5001_10000' as const, annual_revenue_range: 'RANGE_500M_1B' as const,
      headquarters_country: 'Netherlands', headquarters_city: 'Amsterdam',
      website: 'https://meridian-bio.com', stock_ticker: 'MBIO', stock_exchange: 'Euronext',
      description: 'Dutch pharma company with leading positions in vaccines and infectious disease treatments.',
      tags: ['vaccines', 'infectious-disease'], source: 'seed',
      verticals: ['large-pharma'], tas: ['Vaccines', 'Infectious Disease'],
    },
    {
      name: 'SynthoGene Therapeutics', company_type: 'BIOTECH' as const, ownership_status: 'VC_BACKED' as const,
      founded_year: 2021, employee_count_range: 'RANGE_1_10' as const, annual_revenue_range: 'LESS_THAN_1M' as const,
      headquarters_country: 'Israel', headquarters_city: 'Tel Aviv',
      website: 'https://synthogene.io',
      description: 'Stealth-mode synthetic biology startup developing RNA therapeutics for metabolic diseases.',
      tags: ['rna', 'synthetic-biology', 'seed'], source: 'seed',
      verticals: ['biotech-preclinical'], tas: ['Metabolic / Diabetes / Obesity'],
    },
    // HEALTH IT / DIGITAL HEALTH (10)
    {
      name: 'Luminex Health Technologies', company_type: 'HEALTH_IT' as const, ownership_status: 'VC_BACKED' as const,
      founded_year: 2015, employee_count_range: 'RANGE_201_500' as const, annual_revenue_range: 'RANGE_10_50M' as const,
      headquarters_country: 'United States', headquarters_city: 'Chicago', headquarters_state_province: 'IL',
      website: 'https://luminexhealth.com',
      description: 'AI-powered EHR analytics platform helping health systems reduce readmissions and improve population health outcomes.',
      tags: ['ehr-analytics', 'population-health', 'whai-sponsor'], source: 'seed',
      verticals: ['ehr-emr', 'population-health', 'clinical-ai'], tas: ['Cardiovascular', 'Mental Health / Psychiatry'],
    },
    {
      name: 'CareStream Digital Health', company_type: 'HEALTH_IT' as const, ownership_status: 'PE_BACKED' as const,
      founded_year: 2011, employee_count_range: 'RANGE_501_1000' as const, annual_revenue_range: 'RANGE_50_100M' as const,
      headquarters_country: 'United States', headquarters_city: 'New York', headquarters_state_province: 'NY',
      website: 'https://carestream.digital',
      description: 'Telehealth and virtual care platform serving 1,500+ provider groups across North America.',
      tags: ['telehealth', 'virtual-care', 'series-d'], source: 'seed',
      verticals: ['telemedicine'], tas: ['Mental Health / Psychiatry', 'Cardiovascular'],
    },
    {
      name: 'MedAI Systems', company_type: 'HEALTH_IT' as const, ownership_status: 'VC_BACKED' as const,
      founded_year: 2017, employee_count_range: 'RANGE_51_200' as const, annual_revenue_range: 'RANGE_1_10M' as const,
      headquarters_country: 'United Kingdom', headquarters_city: 'London',
      website: 'https://medai.systems',
      description: 'Radiology AI platform reducing diagnostic errors in chest X-ray and CT interpretation.',
      tags: ['radiology-ai', 'diagnostic-ai', 'nhs-partner'], source: 'seed',
      verticals: ['medical-imaging-ai', 'clinical-ai'], tas: ['Oncology', 'Respiratory'],
    },
    {
      name: 'PatientPath Technologies', company_type: 'HEALTH_IT' as const, ownership_status: 'PRIVATE' as const,
      founded_year: 2013, employee_count_range: 'RANGE_51_200' as const, annual_revenue_range: 'RANGE_10_50M' as const,
      headquarters_country: 'United States', headquarters_city: 'Nashville', headquarters_state_province: 'TN',
      website: 'https://patientpath.com',
      description: 'Revenue cycle management software trusted by over 200 US health systems.',
      tags: ['rcm', 'revenue-cycle', 'health-systems'], source: 'seed',
      verticals: ['revenue-cycle'], tas: [],
    },
    {
      name: 'Quantis Health Intelligence', company_type: 'HEALTH_IT' as const, ownership_status: 'VC_BACKED' as const,
      founded_year: 2019, employee_count_range: 'RANGE_51_200' as const, annual_revenue_range: 'RANGE_1_10M' as const,
      headquarters_country: 'United States', headquarters_city: 'Boston', headquarters_state_province: 'MA',
      website: 'https://quantishealth.ai',
      description: 'NLP and generative AI platform extracting clinical insights from unstructured medical records.',
      tags: ['nlp', 'generative-ai', 'ehr-integration'], source: 'seed',
      verticals: ['nlp-clinical', 'generative-ai'], tas: ['Oncology', 'Cardiovascular'],
    },
    {
      name: 'BioSignal Wearables', company_type: 'HEALTH_IT' as const, ownership_status: 'PUBLIC' as const,
      founded_year: 2014, employee_count_range: 'RANGE_201_500' as const, annual_revenue_range: 'RANGE_50_100M' as const,
      headquarters_country: 'Sweden', headquarters_city: 'Stockholm',
      website: 'https://biosignal.se', stock_ticker: 'BSGN', stock_exchange: 'Nasdaq Nordic',
      description: 'Continuous cardiac monitoring wearables for early arrhythmia detection, used in 40+ countries.',
      tags: ['wearables', 'cardiac', 'remote-monitoring'], source: 'seed',
      verticals: ['wearables', 'remote-monitoring'], tas: ['Cardiovascular'],
    },
    {
      name: 'ConnectCare Platforms', company_type: 'HEALTH_IT' as const, ownership_status: 'VC_BACKED' as const,
      founded_year: 2016, employee_count_range: 'RANGE_51_200' as const, annual_revenue_range: 'RANGE_10_50M' as const,
      headquarters_country: 'Australia', headquarters_city: 'Sydney',
      website: 'https://connectcare.com.au',
      description: 'Patient engagement and care coordination platform for aged care and post-acute settings.',
      tags: ['patient-engagement', 'aged-care', 'australia'], source: 'seed',
      verticals: ['telemedicine', 'home-health'], tas: ['Paediatrics', 'Women\'s Health'],
    },
    {
      name: 'HealthFlow Analytics', company_type: 'HEALTH_IT' as const, ownership_status: 'PRIVATE' as const,
      founded_year: 2010, employee_count_range: 'RANGE_201_500' as const, annual_revenue_range: 'RANGE_50_100M' as const,
      headquarters_country: 'United States', headquarters_city: 'Atlanta', headquarters_state_province: 'GA',
      website: 'https://healthflowanalytics.com',
      description: 'Predictive analytics and care management SaaS for Medicare Advantage plans.',
      tags: ['predictive-analytics', 'medicare-advantage', 'value-based-care'], source: 'seed',
      verticals: ['predictive-analytics', 'population-health'], tas: ['Cardiovascular', 'Metabolic / Diabetes / Obesity'],
    },
    {
      name: 'Synapse Clinical AI', company_type: 'HEALTH_IT' as const, ownership_status: 'VC_BACKED' as const,
      founded_year: 2020, employee_count_range: 'RANGE_11_50' as const, annual_revenue_range: 'RANGE_1_10M' as const,
      headquarters_country: 'Singapore', headquarters_city: 'Singapore',
      website: 'https://synapse.ai',
      description: 'Agentic AI assistants for clinical documentation, reducing physician burnout across APAC health systems.',
      tags: ['agentic-ai', 'clinical-documentation', 'apac'], source: 'seed',
      verticals: ['agentic-ai', 'clinical-ai'], tas: [],
    },
    {
      name: 'NexGen Health Exchange', company_type: 'HEALTH_IT' as const, ownership_status: 'PE_BACKED' as const,
      founded_year: 2007, employee_count_range: 'RANGE_201_500' as const, annual_revenue_range: 'RANGE_50_100M' as const,
      headquarters_country: 'United States', headquarters_city: 'Minneapolis', headquarters_state_province: 'MN',
      website: 'https://nexgenhx.com',
      description: 'Health information exchange infrastructure serving 18 state HIE networks in the US.',
      tags: ['hie', 'interoperability', 'data-exchange'], source: 'seed',
      verticals: ['hie'], tas: [],
    },
    // MEDICAL DEVICE (5)
    {
      name: 'Kinetic Surgical Technologies', company_type: 'MEDTECH' as const, ownership_status: 'PUBLIC' as const,
      founded_year: 2003, employee_count_range: 'RANGE_1001_5000' as const, annual_revenue_range: 'RANGE_100_500M' as const,
      headquarters_country: 'United States', headquarters_city: 'Austin', headquarters_state_province: 'TX',
      website: 'https://kineticsurgical.com', stock_ticker: 'KNST', stock_exchange: 'NYSE',
      description: 'Robotic-assisted surgical systems for minimally invasive orthopaedic and spinal procedures.',
      tags: ['surgical-robotics', 'orthopaedics', 'medtech'], source: 'seed',
      verticals: ['surgical-robotics', 'implantables'], tas: ['Musculoskeletal / Orthopaedics'],
    },
    {
      name: 'DiagnoPath IVD', company_type: 'MEDTECH' as const, ownership_status: 'PRIVATE' as const,
      founded_year: 2008, employee_count_range: 'RANGE_201_500' as const, annual_revenue_range: 'RANGE_50_100M' as const,
      headquarters_country: 'Germany', headquarters_city: 'Heidelberg',
      website: 'https://diagnopath.de',
      description: 'Molecular diagnostics company specialising in liquid biopsy and oncology IVD tests.',
      tags: ['liquid-biopsy', 'molecular-diagnostics', 'ivd'], source: 'seed',
      verticals: ['ivd', 'poc-diagnostics'], tas: ['Oncology'],
    },
    {
      name: 'OptiVision Ophthalmics', company_type: 'MEDTECH' as const, ownership_status: 'PUBLIC' as const,
      founded_year: 1996, employee_count_range: 'RANGE_501_1000' as const, annual_revenue_range: 'RANGE_100_500M' as const,
      headquarters_country: 'Japan', headquarters_city: 'Tokyo',
      website: 'https://optivision.co.jp', stock_ticker: 'OPTV', stock_exchange: 'TSE',
      description: 'Ophthalmic surgical devices and AI-powered retinal imaging for diabetic retinopathy screening.',
      tags: ['ophthalmology', 'retinal-ai', 'japan'], source: 'seed',
      verticals: ['imaging-equipment', 'clinical-ai'], tas: ['Ophthalmology', 'Metabolic / Diabetes / Obesity'],
    },
    {
      name: 'CardioSense Devices', company_type: 'MEDTECH' as const, ownership_status: 'VC_BACKED' as const,
      founded_year: 2017, employee_count_range: 'RANGE_51_200' as const, annual_revenue_range: 'RANGE_1_10M' as const,
      headquarters_country: 'United States', headquarters_city: 'Minneapolis', headquarters_state_province: 'MN',
      website: 'https://cardiosense.io',
      description: 'Implantable cardiac monitors with AI-powered arrhythmia detection and remote telemetry.',
      tags: ['cardiac', 'implantables', 'remote-monitoring'], source: 'seed',
      verticals: ['implantables', 'wearables'], tas: ['Cardiovascular'],
    },
    {
      name: 'ProteomicScan Technologies', company_type: 'MEDTECH' as const, ownership_status: 'PRIVATE' as const,
      founded_year: 2011, employee_count_range: 'RANGE_51_200' as const, annual_revenue_range: 'RANGE_10_50M' as const,
      headquarters_country: 'United States', headquarters_city: 'San Diego', headquarters_state_province: 'CA',
      website: 'https://proteomicscan.com',
      description: 'Next-generation mass spectrometry platforms for proteomics research and clinical biomarker discovery.',
      tags: ['proteomics', 'biomarkers', 'research-tools'], source: 'seed',
      verticals: ['ivd'], tas: ['Oncology', 'Rare Diseases / Orphan Drugs'],
    },
    // CROs / CDMOs (5)
    {
      name: 'Praxis Clinical Research', company_type: 'CRO' as const, ownership_status: 'PUBLIC' as const,
      founded_year: 1988, employee_count_range: 'RANGE_10000_PLUS' as const, annual_revenue_range: 'ABOVE_1B' as const,
      headquarters_country: 'United States', headquarters_city: 'Raleigh', headquarters_state_province: 'NC',
      website: 'https://praxiscro.com', stock_ticker: 'PRXS', stock_exchange: 'NASDAQ',
      description: 'Full-service CRO with deep expertise in oncology, rare disease, and Phase I-III trials globally.',
      tags: ['global-cro', 'oncology-trials', 'phase-i-iii'], source: 'seed',
      verticals: ['cro', 'clinical-trials'], tas: ['Oncology', 'Rare Diseases / Orphan Drugs'],
    },
    {
      name: 'BioManufact Partners', company_type: 'CDMO' as const, ownership_status: 'PE_BACKED' as const,
      founded_year: 2001, employee_count_range: 'RANGE_1001_5000' as const, annual_revenue_range: 'RANGE_500M_1B' as const,
      headquarters_country: 'Switzerland', headquarters_city: 'Zurich',
      website: 'https://biomanufact.ch',
      description: 'End-to-end biologics CDMO specialising in cell & gene therapy manufacturing scale-up.',
      tags: ['cell-gene-therapy', 'biologics', 'cdmo'], source: 'seed',
      verticals: ['cdmo'], tas: ['Gene Therapy / Cell Therapy', 'Oncology'],
    },
    {
      name: 'TrialSpark Innovations', company_type: 'CRO' as const, ownership_status: 'VC_BACKED' as const,
      founded_year: 2016, employee_count_range: 'RANGE_201_500' as const, annual_revenue_range: 'RANGE_10_50M' as const,
      headquarters_country: 'United States', headquarters_city: 'New York', headquarters_state_province: 'NY',
      website: 'https://trialspark.com',
      description: 'Decentralised clinical trials (DCT) platform enabling faster patient recruitment and remote monitoring.',
      tags: ['dct', 'decentralised-trials', 'patient-recruitment'], source: 'seed',
      verticals: ['clinical-trials', 'remote-monitoring'], tas: ['Oncology', 'Cardiovascular'],
    },
    {
      name: 'PathBio Manufacturing', company_type: 'CDMO' as const, ownership_status: 'PRIVATE' as const,
      founded_year: 2009, employee_count_range: 'RANGE_501_1000' as const, annual_revenue_range: 'RANGE_100_500M' as const,
      headquarters_country: 'India', headquarters_city: 'Hyderabad',
      website: 'https://pathbio.in',
      description: 'Indian CDMO providing small molecule and API manufacturing with global GMP compliance.',
      tags: ['api-manufacturing', 'small-molecule', 'india'], source: 'seed',
      verticals: ['cdmo'], tas: ['Infectious Disease', 'Respiratory'],
    },
    {
      name: 'RealEvidence Analytics', company_type: 'CRO' as const, ownership_status: 'PE_BACKED' as const,
      founded_year: 2013, employee_count_range: 'RANGE_201_500' as const, annual_revenue_range: 'RANGE_50_100M' as const,
      headquarters_country: 'United Kingdom', headquarters_city: 'Oxford',
      website: 'https://realevidence.co.uk',
      description: 'Real-world evidence (RWE) and HEOR consultancy supporting pharma market access and regulatory submissions.',
      tags: ['rwe', 'heor', 'market-access'], source: 'seed',
      verticals: ['rwe', 'reg-tech'], tas: ['Oncology', 'Cardiovascular', 'Rare Diseases / Orphan Drugs'],
    },
    // PROVIDERS / HEALTH SYSTEMS (5)
    {
      name: 'Meridian Health Network', company_type: 'PROVIDER' as const, ownership_status: 'NON_PROFIT' as const,
      founded_year: 1923, employee_count_range: 'RANGE_10000_PLUS' as const, annual_revenue_range: 'ABOVE_1B' as const,
      headquarters_country: 'United States', headquarters_city: 'Philadelphia', headquarters_state_province: 'PA',
      website: 'https://meridianhealth.org',
      description: 'Integrated health system with 12 hospitals and 200+ outpatient sites across the Mid-Atlantic region.',
      tags: ['health-system', 'non-profit', 'value-based-care'], source: 'seed',
      verticals: ['hospitals', 'value-based-care'], tas: ['Cardiovascular', 'Oncology', 'Musculoskeletal / Orthopaedics'],
    },
    {
      name: 'NHS Greater London Trust', company_type: 'PROVIDER' as const, ownership_status: 'GOVERNMENT' as const,
      founded_year: 1948, employee_count_range: 'RANGE_10000_PLUS' as const, annual_revenue_range: 'ABOVE_1B' as const,
      headquarters_country: 'United Kingdom', headquarters_city: 'London',
      website: 'https://nhsgreatlondon.nhs.uk',
      description: 'Major NHS foundation trust providing acute, community and mental health services across Greater London.',
      tags: ['nhs', 'public-health', 'digital-transformation'], source: 'seed',
      verticals: ['hospitals', 'behavioural-health'], tas: ['Mental Health / Psychiatry', 'Cardiovascular'],
    },
    {
      name: 'CareFirst Ambulatory Group', company_type: 'PROVIDER' as const, ownership_status: 'PE_BACKED' as const,
      founded_year: 2005, employee_count_range: 'RANGE_1001_5000' as const, annual_revenue_range: 'RANGE_100_500M' as const,
      headquarters_country: 'United States', headquarters_city: 'Dallas', headquarters_state_province: 'TX',
      website: 'https://carefirst.health',
      description: 'PE-backed network of 300+ ambulatory surgery centres and urgent care clinics in the Sun Belt.',
      tags: ['ambulatory', 'pe-backed', 'surgery-centres'], source: 'seed',
      verticals: ['ambulatory', 'value-based-care'], tas: ['Musculoskeletal / Orthopaedics', 'Ophthalmology'],
    },
    {
      name: 'SingHealth Academic Medical Centre', company_type: 'PROVIDER' as const, ownership_status: 'GOVERNMENT' as const,
      founded_year: 2000, employee_count_range: 'RANGE_10000_PLUS' as const, annual_revenue_range: 'RANGE_500M_1B' as const,
      headquarters_country: 'Singapore', headquarters_city: 'Singapore',
      website: 'https://singhealth.com.sg',
      description: 'Singapore\'s largest public health cluster, integrating clinical care, education and research.',
      tags: ['academic-medical', 'singapore', 'research'], source: 'seed',
      verticals: ['hospitals'], tas: ['Oncology', 'Cardiovascular', 'Infectious Disease'],
    },
    {
      name: 'MindWell Behavioural Health', company_type: 'PROVIDER' as const, ownership_status: 'VC_BACKED' as const,
      founded_year: 2019, employee_count_range: 'RANGE_201_500' as const, annual_revenue_range: 'RANGE_10_50M' as const,
      headquarters_country: 'United States', headquarters_city: 'Denver', headquarters_state_province: 'CO',
      website: 'https://mindwell.health',
      description: 'Tech-enabled behavioural health network combining virtual therapy with in-person care for employers.',
      tags: ['mental-health', 'employer-health', 'virtual-therapy'], source: 'seed',
      verticals: ['behavioural-health', 'telemedicine'], tas: ['Mental Health / Psychiatry'],
    },
    // INVESTORS PE/VC (5)
    {
      name: 'Apogee Health Ventures', company_type: 'INVESTOR' as const, ownership_status: 'PRIVATE' as const,
      founded_year: 2008, employee_count_range: 'RANGE_11_50' as const, annual_revenue_range: 'LESS_THAN_1M' as const,
      headquarters_country: 'United States', headquarters_city: 'San Francisco', headquarters_state_province: 'CA',
      website: 'https://apogeehv.com',
      description: 'Healthcare-focused venture capital firm managing $2.1B across three funds, specialising in digital health and biotech.',
      tags: ['venture-capital', 'digital-health', 'biotech', 'whai-sponsor'], source: 'seed',
      verticals: ['healthcare-pe-vc'], tas: ['Oncology', 'Metabolic / Diabetes / Obesity'],
    },
    {
      name: 'Sovereign Healthcare Capital', company_type: 'INVESTOR' as const, ownership_status: 'PRIVATE' as const,
      founded_year: 1999, employee_count_range: 'RANGE_51_200' as const, annual_revenue_range: 'RANGE_10_50M' as const,
      headquarters_country: 'United Kingdom', headquarters_city: 'London',
      website: 'https://sovereignhc.com',
      description: 'European private equity firm with £1.8B AUM, investing in healthcare services, pharma and medtech buyouts.',
      tags: ['private-equity', 'buyout', 'healthcare-services', 'europe'], source: 'seed',
      verticals: ['healthcare-pe-vc'], tas: [],
    },
    {
      name: 'PinPoint Bioventures', company_type: 'INVESTOR' as const, ownership_status: 'PRIVATE' as const,
      founded_year: 2015, employee_count_range: 'RANGE_11_50' as const, annual_revenue_range: 'LESS_THAN_1M' as const,
      headquarters_country: 'United States', headquarters_city: 'Boston', headquarters_state_province: 'MA',
      website: 'https://pinpointbio.vc',
      description: 'Seed and Series A investor in early-stage biopharma, with a focus on precision oncology and gene therapy.',
      tags: ['seed-vc', 'early-stage', 'oncology', 'gene-therapy'], source: 'seed',
      verticals: ['healthcare-pe-vc'], tas: ['Oncology', 'Gene Therapy / Cell Therapy'],
    },
    {
      name: 'Vantage Health Growth Partners', company_type: 'INVESTOR' as const, ownership_status: 'PRIVATE' as const,
      founded_year: 2011, employee_count_range: 'RANGE_11_50' as const, annual_revenue_range: 'RANGE_1_10M' as const,
      headquarters_country: 'United States', headquarters_city: 'New York', headquarters_state_province: 'NY',
      website: 'https://vantagehgp.com',
      description: 'Growth equity investor in health IT and value-based care businesses, $600M AUM.',
      tags: ['growth-equity', 'health-it', 'value-based-care'], source: 'seed',
      verticals: ['healthcare-pe-vc'], tas: [],
    },
    {
      name: 'Horizon MedTech Fund', company_type: 'INVESTOR' as const, ownership_status: 'PRIVATE' as const,
      founded_year: 2006, employee_count_range: 'RANGE_11_50' as const, annual_revenue_range: 'RANGE_1_10M' as const,
      headquarters_country: 'Germany', headquarters_city: 'Berlin',
      website: 'https://horizonmedtech.de',
      description: 'Pan-European medtech and diagnostics venture fund with €450M under management.',
      tags: ['medtech-vc', 'europe', 'diagnostics'], source: 'seed',
      verticals: ['healthcare-pe-vc'], tas: [],
    },
    // CONSULTING / ADVISORY (5)
    {
      name: 'Meridian Health Advisors', company_type: 'CONSULTING' as const, ownership_status: 'PRIVATE' as const,
      founded_year: 2003, employee_count_range: 'RANGE_51_200' as const, annual_revenue_range: 'RANGE_50_100M' as const,
      headquarters_country: 'United States', headquarters_city: 'Washington', headquarters_state_province: 'DC',
      website: 'https://meridianadvisors.com',
      description: 'Healthcare strategy and policy consultancy advising pharma, payers and government agencies on market access and reimbursement.',
      tags: ['strategy', 'market-access', 'policy', 'dc'], source: 'seed',
      verticals: ['healthcare-consulting'], tas: ['Oncology', 'Rare Diseases / Orphan Drugs'],
    },
    {
      name: 'HealthTech Insights Group', company_type: 'CONSULTING' as const, ownership_status: 'PRIVATE' as const,
      founded_year: 2009, employee_count_range: 'RANGE_51_200' as const, annual_revenue_range: 'RANGE_50_100M' as const,
      headquarters_country: 'United Kingdom', headquarters_city: 'London',
      website: 'https://healthtechinsights.co.uk',
      description: 'Digital health and health IT advisory firm helping NHS Trusts and European health systems implement transformative technology.',
      tags: ['digital-health-consulting', 'nhs', 'transformation'], source: 'seed',
      verticals: ['healthcare-consulting'], tas: [],
    },
    {
      name: 'BioStrategy Partners', company_type: 'CONSULTING' as const, ownership_status: 'PRIVATE' as const,
      founded_year: 1997, employee_count_range: 'RANGE_201_500' as const, annual_revenue_range: 'RANGE_100_500M' as const,
      headquarters_country: 'Switzerland', headquarters_city: 'Zurich',
      website: 'https://biostrategy.ch',
      description: 'Life sciences strategy consultancy specialising in commercial excellence, pipeline strategy and M&A due diligence.',
      tags: ['life-sciences', 'ma-advisory', 'pipeline-strategy'], source: 'seed',
      verticals: ['healthcare-consulting'], tas: ['Oncology', 'Immunology / Autoimmune'],
    },
    {
      name: 'PrecisionPath Consulting', company_type: 'CONSULTING' as const, ownership_status: 'PRIVATE' as const,
      founded_year: 2014, employee_count_range: 'RANGE_11_50' as const, annual_revenue_range: 'RANGE_10_50M' as const,
      headquarters_country: 'United States', headquarters_city: 'San Francisco', headquarters_state_province: 'CA',
      website: 'https://precisionpath.health',
      description: 'Boutique consulting firm focused on precision medicine strategy and real-world evidence for biopharma.',
      tags: ['precision-medicine', 'rwe', 'boutique'], source: 'seed',
      verticals: ['healthcare-consulting'], tas: ['Oncology', 'Rare Diseases / Orphan Drugs', 'Gene Therapy / Cell Therapy'],
    },
    {
      name: 'Global Health Economics Ltd', company_type: 'CONSULTING' as const, ownership_status: 'PRIVATE' as const,
      founded_year: 2005, employee_count_range: 'RANGE_51_200' as const, annual_revenue_range: 'RANGE_50_100M' as const,
      headquarters_country: 'United Kingdom', headquarters_city: 'Manchester',
      website: 'https://gheconomics.co.uk',
      description: 'Health economics and outcomes research (HEOR) consultancy supporting HTA submissions globally.',
      tags: ['heor', 'hta', 'health-economics'], source: 'seed',
      verticals: ['healthcare-consulting'], tas: ['Cardiovascular', 'Oncology', 'Rare Diseases / Orphan Drugs'],
    },
    // GOVERNMENT / ASSOCIATIONS (5)
    {
      name: 'NHS England Digital', company_type: 'GOVERNMENT' as const, ownership_status: 'GOVERNMENT' as const,
      founded_year: 2013, employee_count_range: 'RANGE_5001_10000' as const, annual_revenue_range: 'ABOVE_1B' as const,
      headquarters_country: 'United Kingdom', headquarters_city: 'London',
      website: 'https://digital.nhs.uk',
      description: 'NHS\'s national information and technology partner, responsible for standards, infrastructure and data.',
      tags: ['nhs', 'government', 'digital-infrastructure', 'whai-partner'], source: 'seed',
      verticals: ['government-public-health', 'hie'], tas: [],
    },
    {
      name: 'US FDA Center for Drug Evaluation', company_type: 'GOVERNMENT' as const, ownership_status: 'GOVERNMENT' as const,
      founded_year: 1938, employee_count_range: 'RANGE_5001_10000' as const, annual_revenue_range: 'ABOVE_1B' as const,
      headquarters_country: 'United States', headquarters_city: 'Silver Spring', headquarters_state_province: 'MD',
      website: 'https://fda.gov/drugs',
      description: 'US FDA center responsible for approving and regulating human drugs and biologics.',
      tags: ['fda', 'regulatory', 'government'], source: 'seed',
      verticals: ['government-public-health'], tas: [],
    },
    {
      name: 'European Medicines Agency (EMA)', company_type: 'GOVERNMENT' as const, ownership_status: 'GOVERNMENT' as const,
      founded_year: 1995, employee_count_range: 'RANGE_501_1000' as const, annual_revenue_range: 'RANGE_100_500M' as const,
      headquarters_country: 'Netherlands', headquarters_city: 'Amsterdam',
      website: 'https://ema.europa.eu',
      description: 'EU agency responsible for the scientific evaluation, supervision and safety monitoring of medicines.',
      tags: ['ema', 'eu-regulatory', 'government'], source: 'seed',
      verticals: ['government-public-health', 'reg-tech'], tas: [],
    },
    {
      name: 'Healthcare Innovation Alliance', company_type: 'INDUSTRY_ASSOCIATION' as const, ownership_status: 'NON_PROFIT' as const,
      founded_year: 2007, employee_count_range: 'RANGE_11_50' as const, annual_revenue_range: 'RANGE_1_10M' as const,
      headquarters_country: 'United States', headquarters_city: 'Washington', headquarters_state_province: 'DC',
      website: 'https://hcinnovation.org',
      description: 'Trade association representing 200+ health IT and digital health companies, advocating for interoperability and innovation.',
      tags: ['trade-association', 'health-it', 'policy', 'whai-partner'], source: 'seed',
      verticals: ['government-public-health'], tas: [],
    },
    {
      name: 'World Health Innovation Summit (WHIS)', company_type: 'INDUSTRY_ASSOCIATION' as const, ownership_status: 'NON_PROFIT' as const,
      founded_year: 2015, employee_count_range: 'RANGE_11_50' as const, annual_revenue_range: 'RANGE_1_10M' as const,
      headquarters_country: 'United Arab Emirates', headquarters_city: 'Dubai',
      website: 'https://whis.ae',
      description: 'International healthcare innovation platform connecting health leaders, investors and innovators across 60+ countries.',
      tags: ['events', 'global-health', 'uae', 'whai-partner'], source: 'seed',
      verticals: ['government-public-health'], tas: [],
    },
  ]

  const companyIds: Record<string, string> = {}
  for (const c of companyData) {
    const { verticals: cverts, tas: ctas, ...data } = c
    const company = await prisma.company.upsert({
      where: { id: `seed-${data.name.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 40)}` },
      update: {},
      create: {
        id: `seed-${data.name.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 40)}`,
        ...data,
      },
    })
    companyIds[data.name] = company.id
    // Verticals
    for (let i = 0; i < cverts.length; i++) {
      const vid = verticalMap[cverts[i]]
      if (vid) {
        await prisma.companyVertical.upsert({
          where: { company_id_vertical_id: { company_id: company.id, vertical_id: vid } },
          update: {},
          create: { company_id: company.id, vertical_id: vid, is_primary: i === 0 },
        })
      }
    }
    // Therapeutic Areas
    for (const ta of ctas) {
      const tid = taMap[ta]
      if (tid) {
        await prisma.companyTherapeuticArea.upsert({
          where: { company_id_therapeutic_area_id: { company_id: company.id, therapeutic_area_id: tid } },
          update: {},
          create: { company_id: company.id, therapeutic_area_id: tid },
        })
      }
    }
  }
  console.log(`  → Created ${Object.keys(companyIds).length} companies`)


  // ─── CONTACTS ─────────────────────────────────────────────────────────────
  console.log('→ Seeding contacts...')

  // Helper to get company ID safely
  const cid = (name: string) => companyIds[name] ?? null

  const contacts = [
    // NovaMedica Therapeutics
    { first_name: 'Sarah', last_name: 'Chen', email: 'sarah.chen@novamedica.com', job_title: 'Chief Medical Officer', seniority_level: 'C_SUITE', department: 'CLINICAL', jf: 'Clinical / Medical Affairs', company: 'NovaMedica Therapeutics', country: 'United States', city: 'Cambridge', region: 'us', engagement_score: 92, is_verified: true, tags: ['WHAI Boston 2026', 'KOL'] },
    { first_name: 'James', last_name: 'Whitfield', email: 'j.whitfield@novamedica.com', job_title: 'VP Oncology Clinical Development', seniority_level: 'VP', department: 'CLINICAL', jf: 'Clinical / Medical Affairs', company: 'NovaMedica Therapeutics', country: 'United States', city: 'Cambridge', region: 'us', engagement_score: 75, is_verified: true, tags: ['KOL', 'oncology'] },
    { first_name: 'Priya', last_name: 'Nair', email: 'p.nair@novamedica.com', job_title: 'Director, Business Development', seniority_level: 'DIRECTOR', department: 'STRATEGY', jf: 'Business Development / Partnerships', company: 'NovaMedica Therapeutics', country: 'United States', city: 'Cambridge', region: 'us', engagement_score: 68, is_verified: true, tags: ['bd', 'partnerships'] },
    { first_name: 'Michael', last_name: 'Torres', email: 'm.torres@novamedica.com', job_title: 'Head of Regulatory Affairs', seniority_level: 'DIRECTOR', department: 'REGULATORY', jf: 'Regulatory Affairs', company: 'NovaMedica Therapeutics', country: 'United States', city: 'Cambridge', region: 'us', engagement_score: 55, is_verified: true, tags: [] },
    { first_name: 'Amara', last_name: 'Osei', email: 'a.osei@novamedica.com', job_title: 'Senior Scientist, Immuno-Oncology', seniority_level: 'INDIVIDUAL_CONTRIBUTOR', department: 'RD', jf: 'Research & Development', company: 'NovaMedica Therapeutics', country: 'United States', city: 'Cambridge', region: 'us', engagement_score: 40, is_verified: false, tags: [] },
    // Axiom Biosciences
    { first_name: 'Dr. Lena', last_name: 'Schmidt', email: 'lena.schmidt@axiombio.com', job_title: 'CEO & Co-Founder', seniority_level: 'C_SUITE', department: 'EXECUTIVE_LEADERSHIP', jf: 'Strategy / Corporate Development', company: 'Axiom Biosciences', country: 'United States', city: 'Boston', region: 'us', engagement_score: 88, is_verified: true, tags: ['founder', 'speaker', 'WHAI Boston 2026'] },
    { first_name: 'Raj', last_name: 'Patel', email: 'raj.patel@axiombio.com', job_title: 'Chief Technology Officer', seniority_level: 'C_SUITE', department: 'IT_DIGITAL', jf: 'Data Science / AI / Machine Learning', company: 'Axiom Biosciences', country: 'United States', city: 'Boston', region: 'us', engagement_score: 80, is_verified: true, tags: ['ai', 'drug-discovery'] },
    { first_name: 'Yuki', last_name: 'Tanaka', email: 'y.tanaka@axiombio.com', job_title: 'Principal Data Scientist', seniority_level: 'INDIVIDUAL_CONTRIBUTOR', department: 'RD', jf: 'Data Science / AI / Machine Learning', company: 'Axiom Biosciences', country: 'United States', city: 'Boston', region: 'us', engagement_score: 55, is_verified: false, tags: [] },
    // Helix Pharma Group
    { first_name: 'Jonathan', last_name: 'Hargreaves', email: 'j.hargreaves@helixpharma.co.uk', job_title: 'Chief Executive Officer', seniority_level: 'C_SUITE', department: 'EXECUTIVE_LEADERSHIP', jf: 'Strategy / Corporate Development', company: 'Helix Pharma Group', country: 'United Kingdom', city: 'London', region: 'uk', engagement_score: 85, is_verified: true, tags: ['FTSE-CEO', 'speaker'] },
    { first_name: 'Catherine', last_name: 'Blackwood', email: 'c.blackwood@helixpharma.co.uk', job_title: 'VP Commercial Operations, Europe', seniority_level: 'VP', department: 'COMMERCIAL', jf: 'Commercial / Sales', company: 'Helix Pharma Group', country: 'United Kingdom', city: 'London', region: 'uk', engagement_score: 65, is_verified: true, tags: ['commercial', 'europe'] },
    { first_name: 'Marcus', last_name: 'Bergmann', email: 'm.bergmann@helixpharma.co.uk', job_title: 'Director, R&D Strategy', seniority_level: 'DIRECTOR', department: 'STRATEGY', jf: 'Strategy / Corporate Development', company: 'Helix Pharma Group', country: 'Germany', city: 'Munich', region: 'germany', engagement_score: 48, is_verified: false, tags: [] },
    // Luminex Health Technologies
    { first_name: 'Angela', last_name: 'Martinez', email: 'a.martinez@luminexhealth.com', job_title: 'Chief Executive Officer', seniority_level: 'C_SUITE', department: 'EXECUTIVE_LEADERSHIP', jf: 'Strategy / Corporate Development', company: 'Luminex Health Technologies', country: 'United States', city: 'Chicago', region: 'us', engagement_score: 90, is_verified: true, tags: ['WHAI Chicago 2025', 'speaker', 'whai-board'] },
    { first_name: 'David', last_name: 'Kim', email: 'd.kim@luminexhealth.com', job_title: 'VP Product, AI Analytics', seniority_level: 'VP', department: 'IT_DIGITAL', jf: 'Digital Health / Innovation', company: 'Luminex Health Technologies', country: 'United States', city: 'Chicago', region: 'us', engagement_score: 77, is_verified: true, tags: ['ai-product', 'WHAI Chicago 2025'] },
    { first_name: 'Fatima', last_name: 'Al-Hassan', email: 'f.alhassan@luminexhealth.com', job_title: 'Director of Clinical Informatics', seniority_level: 'DIRECTOR', department: 'CLINICAL', jf: 'Clinical / Medical Affairs', company: 'Luminex Health Technologies', country: 'United States', city: 'Chicago', region: 'us', engagement_score: 62, is_verified: true, tags: [] },
    { first_name: 'Thomas', last_name: 'Okonkwo', email: 't.okonkwo@luminexhealth.com', job_title: 'Senior Data Engineer', seniority_level: 'INDIVIDUAL_CONTRIBUTOR', department: 'IT_DIGITAL', jf: 'Data Science / AI / Machine Learning', company: 'Luminex Health Technologies', country: 'United States', city: 'Chicago', region: 'us', engagement_score: 35, is_verified: false, tags: [] },
    // CareStream Digital Health
    { first_name: 'Olivia', last_name: 'Walsh', email: 'o.walsh@carestream.digital', job_title: 'President & CEO', seniority_level: 'C_SUITE', department: 'EXECUTIVE_LEADERSHIP', jf: 'Strategy / Corporate Development', company: 'CareStream Digital Health', country: 'United States', city: 'New York', region: 'us', engagement_score: 84, is_verified: true, tags: ['telehealth-ceo', 'WHAI NY 2025'] },
    { first_name: 'Brandon', last_name: 'Lee', email: 'b.lee@carestream.digital', job_title: 'VP Engineering', seniority_level: 'VP', department: 'IT_DIGITAL', jf: 'Information Technology', company: 'CareStream Digital Health', country: 'United States', city: 'New York', region: 'us', engagement_score: 58, is_verified: true, tags: [] },
    // MedAI Systems
    { first_name: 'Alistair', last_name: 'Drummond', email: 'a.drummond@medai.systems', job_title: 'Chief Scientific Officer', seniority_level: 'C_SUITE', department: 'RD', jf: 'Data Science / AI / Machine Learning', company: 'MedAI Systems', country: 'United Kingdom', city: 'London', region: 'uk', engagement_score: 88, is_verified: true, tags: ['radiology-ai', 'speaker', 'NHS-partner'] },
    { first_name: 'Aisha', last_name: 'Koroma', email: 'a.koroma@medai.systems', job_title: 'Head of NHS Partnerships', seniority_level: 'DIRECTOR', department: 'COMMERCIAL', jf: 'Business Development / Partnerships', company: 'MedAI Systems', country: 'United Kingdom', city: 'London', region: 'uk', engagement_score: 70, is_verified: true, tags: ['nhs', 'partnerships'] },
    // Meridian Health Network
    { first_name: 'Robert', last_name: 'Ashworth', email: 'r.ashworth@meridianhealth.org', job_title: 'Chief Information Officer', seniority_level: 'C_SUITE', department: 'IT_DIGITAL', jf: 'Information Technology', company: 'Meridian Health Network', country: 'United States', city: 'Philadelphia', region: 'us', engagement_score: 73, is_verified: true, tags: ['health-system-CIO', 'WHAI Philadelphia 2025'] },
    { first_name: 'Dr. Maria', last_name: 'Gonzalez', email: 'm.gonzalez@meridianhealth.org', job_title: 'Chief Medical Officer', seniority_level: 'C_SUITE', department: 'CLINICAL', jf: 'Clinical / Medical Affairs', company: 'Meridian Health Network', country: 'United States', city: 'Philadelphia', region: 'us', engagement_score: 79, is_verified: true, tags: ['CMO', 'KOL', 'cardiology'] },
    { first_name: 'Jessica', last_name: 'Park', email: 'j.park@meridianhealth.org', job_title: 'VP Value-Based Care', seniority_level: 'VP', department: 'STRATEGY', jf: 'Strategy / Corporate Development', company: 'Meridian Health Network', country: 'United States', city: 'Philadelphia', region: 'us', engagement_score: 65, is_verified: true, tags: ['value-based-care'] },
    // NHS Greater London Trust
    { first_name: 'Dr. William', last_name: 'Jennings', email: 'w.jennings@nhsgreatlondon.nhs.uk', job_title: 'Medical Director', seniority_level: 'C_SUITE', department: 'CLINICAL', jf: 'Clinical / Medical Affairs', company: 'NHS Greater London Trust', country: 'United Kingdom', city: 'London', region: 'uk', engagement_score: 71, is_verified: true, tags: ['NHS', 'KOL', 'digital-health'] },
    { first_name: 'Helen', last_name: 'Morrison', email: 'h.morrison@nhsgreatlondon.nhs.uk', job_title: 'Director of Digital Transformation', seniority_level: 'DIRECTOR', department: 'IT_DIGITAL', jf: 'Digital Health / Innovation', company: 'NHS Greater London Trust', country: 'United Kingdom', city: 'London', region: 'uk', engagement_score: 78, is_verified: true, tags: ['NHS-digital', 'transformation'] },
    { first_name: 'Samuel', last_name: 'Adeyemi', email: 's.adeyemi@nhsgreatlondon.nhs.uk', job_title: 'Head of Mental Health Services', seniority_level: 'DIRECTOR', department: 'CLINICAL', jf: 'Clinical / Medical Affairs', company: 'NHS Greater London Trust', country: 'United Kingdom', city: 'London', region: 'uk', engagement_score: 52, is_verified: false, tags: ['mental-health'] },
    // Apogee Health Ventures
    { first_name: 'Victoria', last_name: 'Hartmann', email: 'v.hartmann@apogeehv.com', job_title: 'Managing Partner', seniority_level: 'C_SUITE', department: 'FINANCE', jf: 'Investor Relations', company: 'Apogee Health Ventures', country: 'United States', city: 'San Francisco', region: 'us', engagement_score: 95, is_verified: true, tags: ['vc', 'digital-health-investor', 'whai-board', 'speaker'] },
    { first_name: 'Daniel', last_name: 'Fung', email: 'd.fung@apogeehv.com', job_title: 'Principal', seniority_level: 'MANAGER', department: 'FINANCE', jf: 'Investor Relations', company: 'Apogee Health Ventures', country: 'United States', city: 'San Francisco', region: 'us', engagement_score: 68, is_verified: true, tags: ['venture', 'investments'] },
    // Sovereign Healthcare Capital
    { first_name: 'Edward', last_name: 'Blackstone', email: 'e.blackstone@sovereignhc.com', job_title: 'Managing Director', seniority_level: 'C_SUITE', department: 'FINANCE', jf: 'Investor Relations', company: 'Sovereign Healthcare Capital', country: 'United Kingdom', city: 'London', region: 'uk', engagement_score: 82, is_verified: true, tags: ['pe', 'healthcare-services', 'speaker'] },
    { first_name: 'Charlotte', last_name: 'Dubois', email: 'c.dubois@sovereignhc.com', job_title: 'Director, Deal Origination', seniority_level: 'DIRECTOR', department: 'STRATEGY', jf: 'Business Development / Partnerships', company: 'Sovereign Healthcare Capital', country: 'France', city: 'Paris', region: 'france', engagement_score: 55, is_verified: true, tags: ['deals', 'origination'] },
    // Praxis Clinical Research
    { first_name: 'Dr. Susan', last_name: 'Watkins', email: 's.watkins@praxiscro.com', job_title: 'Chief Operating Officer', seniority_level: 'C_SUITE', department: 'OPERATIONS', jf: 'Operations', company: 'Praxis Clinical Research', country: 'United States', city: 'Raleigh', region: 'us', engagement_score: 76, is_verified: true, tags: ['cro-ops', 'trials'] },
    { first_name: 'Kevin', last_name: 'O\'Brien', email: 'k.obrien@praxiscro.com', job_title: 'VP Business Development', seniority_level: 'VP', department: 'COMMERCIAL', jf: 'Business Development / Partnerships', company: 'Praxis Clinical Research', country: 'United States', city: 'Raleigh', region: 'us', engagement_score: 61, is_verified: true, tags: ['cro-bd'] },
    { first_name: 'Mei-Ling', last_name: 'Chen', email: 'm.chen@praxiscro.com', job_title: 'Director, Regulatory Strategy', seniority_level: 'DIRECTOR', department: 'REGULATORY', jf: 'Regulatory Affairs', company: 'Praxis Clinical Research', country: 'United States', city: 'Raleigh', region: 'us', engagement_score: 50, is_verified: true, tags: ['regulatory'] },
    // BioManufact Partners
    { first_name: 'Hans', last_name: 'Weber', email: 'h.weber@biomanufact.ch', job_title: 'Chief Executive Officer', seniority_level: 'C_SUITE', department: 'EXECUTIVE_LEADERSHIP', jf: 'Operations', company: 'BioManufact Partners', country: 'Switzerland', city: 'Zurich', region: 'switzerland', engagement_score: 78, is_verified: true, tags: ['cdmo', 'cell-gene-therapy'] },
    { first_name: 'Ingrid', last_name: 'Lindqvist', email: 'i.lindqvist@biomanufact.ch', job_title: 'VP Manufacturing Sciences', seniority_level: 'VP', department: 'OPERATIONS', jf: 'Supply Chain / Manufacturing', company: 'BioManufact Partners', country: 'Sweden', city: 'Gothenburg', region: 'sweden', engagement_score: 48, is_verified: false, tags: [] },
    // Meridian Health Advisors
    { first_name: 'Dr. Patricia', last_name: 'Lawson', email: 'p.lawson@meridianadvisors.com', job_title: 'Managing Director & Founder', seniority_level: 'C_SUITE', department: 'STRATEGY', jf: 'Government Affairs / Policy', company: 'Meridian Health Advisors', country: 'United States', city: 'Washington', region: 'us', engagement_score: 87, is_verified: true, tags: ['policy', 'KOL', 'speaker', 'WHAI DC 2025'] },
    { first_name: 'Gregory', last_name: 'Schaefer', email: 'g.schaefer@meridianadvisors.com', job_title: 'Senior Consultant, Market Access', seniority_level: 'INDIVIDUAL_CONTRIBUTOR', department: 'STRATEGY', jf: 'Strategy / Corporate Development', company: 'Meridian Health Advisors', country: 'United States', city: 'Washington', region: 'us', engagement_score: 42, is_verified: false, tags: ['market-access'] },
    // HealthTech Insights Group
    { first_name: 'Niall', last_name: 'MacAllister', email: 'n.macallister@healthtechinsights.co.uk', job_title: 'CEO', seniority_level: 'C_SUITE', department: 'EXECUTIVE_LEADERSHIP', jf: 'Strategy / Corporate Development', company: 'HealthTech Insights Group', country: 'United Kingdom', city: 'London', region: 'uk', engagement_score: 83, is_verified: true, tags: ['health-it', 'consulting', 'WHAI London 2025'] },
    { first_name: 'Gemma', last_name: 'Price', email: 'g.price@healthtechinsights.co.uk', job_title: 'Head of NHS Digital Practice', seniority_level: 'DIRECTOR', department: 'STRATEGY', jf: 'Digital Health / Innovation', company: 'HealthTech Insights Group', country: 'United Kingdom', city: 'London', region: 'uk', engagement_score: 67, is_verified: true, tags: ['nhs', 'digital'] },
    // NHS England Digital
    { first_name: 'Simon', last_name: 'Fellowes', email: 's.fellowes@digital.nhs.uk', job_title: 'Chief Digital Information Officer', seniority_level: 'C_SUITE', department: 'IT_DIGITAL', jf: 'Digital Health / Innovation', company: 'NHS England Digital', country: 'United Kingdom', city: 'London', region: 'uk', engagement_score: 91, is_verified: true, tags: ['NHS-CDIO', 'KOL', 'whai-board', 'WHAI London 2025'] },
    { first_name: 'Natalie', last_name: 'Clarke', email: 'n.clarke@digital.nhs.uk', job_title: 'Head of Data Policy', seniority_level: 'DIRECTOR', department: 'IT_DIGITAL', jf: 'Government Affairs / Policy', company: 'NHS England Digital', country: 'United Kingdom', city: 'Leeds', region: 'uk', engagement_score: 70, is_verified: true, tags: ['data-policy', 'NHS'] },
    // Kinetic Surgical Technologies
    { first_name: 'Dr. Gregory', last_name: 'Stern', email: 'g.stern@kineticsurgical.com', job_title: 'Chief Medical Officer', seniority_level: 'C_SUITE', department: 'CLINICAL', jf: 'Clinical / Medical Affairs', company: 'Kinetic Surgical Technologies', country: 'United States', city: 'Austin', region: 'us', engagement_score: 80, is_verified: true, tags: ['surgical-robotics', 'orthopaedics'] },
    { first_name: 'Lisa', last_name: 'Morgan', email: 'l.morgan@kineticsurgical.com', job_title: 'VP Sales & Marketing', seniority_level: 'VP', department: 'COMMERCIAL', jf: 'Commercial / Sales', company: 'Kinetic Surgical Technologies', country: 'United States', city: 'Austin', region: 'us', engagement_score: 60, is_verified: true, tags: ['medtech-sales'] },
    // CardioSense Devices
    { first_name: 'Dr. Anand', last_name: 'Krishnamurthy', email: 'a.krishnamurthy@cardiosense.io', job_title: 'Co-Founder & CEO', seniority_level: 'C_SUITE', department: 'EXECUTIVE_LEADERSHIP', jf: 'Strategy / Corporate Development', company: 'CardioSense Devices', country: 'United States', city: 'Minneapolis', region: 'us', engagement_score: 86, is_verified: true, tags: ['cardiac', 'founder', 'WHAI Boston 2026'] },
    // DiagnoPath IVD
    { first_name: 'Dr. Klaus', last_name: 'Brandt', email: 'k.brandt@diagnopath.de', job_title: 'Head of Scientific Affairs', seniority_level: 'DIRECTOR', department: 'RD', jf: 'Research & Development', company: 'DiagnoPath IVD', country: 'Germany', city: 'Heidelberg', region: 'germany', engagement_score: 58, is_verified: true, tags: ['liquid-biopsy', 'diagnostics'] },
    // Quantis Health Intelligence
    { first_name: 'Tara', last_name: 'Jayawardena', email: 't.jayawardena@quantishealth.ai', job_title: 'CEO & Co-Founder', seniority_level: 'C_SUITE', department: 'EXECUTIVE_LEADERSHIP', jf: 'Data Science / AI / Machine Learning', company: 'Quantis Health Intelligence', country: 'United States', city: 'Boston', region: 'us', engagement_score: 89, is_verified: true, tags: ['nlp', 'ai', 'founder', 'speaker'] },
    { first_name: 'Alex', last_name: 'Richardson', email: 'a.richardson@quantishealth.ai', job_title: 'Head of Product', seniority_level: 'DIRECTOR', department: 'IT_DIGITAL', jf: 'Digital Health / Innovation', company: 'Quantis Health Intelligence', country: 'United States', city: 'Boston', region: 'us', engagement_score: 65, is_verified: true, tags: [] },
    // BioSignal Wearables
    { first_name: 'Erik', last_name: 'Lindgren', email: 'e.lindgren@biosignal.se', job_title: 'Chief Executive Officer', seniority_level: 'C_SUITE', department: 'EXECUTIVE_LEADERSHIP', jf: 'Strategy / Corporate Development', company: 'BioSignal Wearables', country: 'Sweden', city: 'Stockholm', region: 'sweden', engagement_score: 77, is_verified: true, tags: ['wearables', 'cardiac', 'nordic'] },
    { first_name: 'Sofia', last_name: 'Gustafsson', email: 's.gustafsson@biosignal.se', job_title: 'VP Clinical Research', seniority_level: 'VP', department: 'RD', jf: 'Clinical / Medical Affairs', company: 'BioSignal Wearables', country: 'Sweden', city: 'Stockholm', region: 'sweden', engagement_score: 62, is_verified: true, tags: [] },
    // PatientPath Technologies
    { first_name: 'Todd', last_name: 'Hammond', email: 't.hammond@patientpath.com', job_title: 'Chief Revenue Officer', seniority_level: 'C_SUITE', department: 'COMMERCIAL', jf: 'Commercial / Sales', company: 'PatientPath Technologies', country: 'United States', city: 'Nashville', region: 'us', engagement_score: 71, is_verified: true, tags: ['rcm', 'health-systems-sales'] },
    // ConnectCare Platforms
    { first_name: 'Samantha', last_name: 'Davies', email: 's.davies@connectcare.com.au', job_title: 'CEO', seniority_level: 'C_SUITE', department: 'EXECUTIVE_LEADERSHIP', jf: 'Strategy / Corporate Development', company: 'ConnectCare Platforms', country: 'Australia', city: 'Sydney', region: 'australia', engagement_score: 74, is_verified: true, tags: ['aged-care', 'australia', 'patient-engagement'] },
    // HealthFlow Analytics
    { first_name: 'Marcus', last_name: 'Williams', email: 'm.williams@healthflowanalytics.com', job_title: 'VP Data Science', seniority_level: 'VP', department: 'IT_DIGITAL', jf: 'Data Science / AI / Machine Learning', company: 'HealthFlow Analytics', country: 'United States', city: 'Atlanta', region: 'us', engagement_score: 64, is_verified: true, tags: ['predictive-analytics', 'medicare'] },
    // Synapse Clinical AI
    { first_name: 'Hiroshi', last_name: 'Yamamoto', email: 'h.yamamoto@synapse.ai', job_title: 'Founder & CEO', seniority_level: 'C_SUITE', department: 'EXECUTIVE_LEADERSHIP', jf: 'Digital Health / Innovation', company: 'Synapse Clinical AI', country: 'Singapore', city: 'Singapore', region: 'singapore', engagement_score: 85, is_verified: true, tags: ['agentic-ai', 'apac', 'founder'] },
    // NexGen Health Exchange
    { first_name: 'Diane', last_name: 'Holloway', email: 'd.holloway@nexgenhx.com', job_title: 'Chief Executive Officer', seniority_level: 'C_SUITE', department: 'EXECUTIVE_LEADERSHIP', jf: 'Strategy / Corporate Development', company: 'NexGen Health Exchange', country: 'United States', city: 'Minneapolis', region: 'us', engagement_score: 69, is_verified: true, tags: ['hie', 'interoperability'] },
    // OptiVision Ophthalmics
    { first_name: 'Kenji', last_name: 'Watanabe', email: 'k.watanabe@optivision.co.jp', job_title: 'President & CEO', seniority_level: 'C_SUITE', department: 'EXECUTIVE_LEADERSHIP', jf: 'Strategy / Corporate Development', company: 'OptiVision Ophthalmics', country: 'Japan', city: 'Tokyo', region: 'japan', engagement_score: 73, is_verified: true, tags: ['ophthalmology', 'japan', 'medtech'] },
    { first_name: 'Yuki', last_name: 'Nakamura', email: 'y.nakamura@optivision.co.jp', job_title: 'Head of AI Research', seniority_level: 'DIRECTOR', department: 'RD', jf: 'Data Science / AI / Machine Learning', company: 'OptiVision Ophthalmics', country: 'Japan', city: 'Tokyo', region: 'japan', engagement_score: 52, is_verified: false, tags: ['retinal-ai'] },
    // ProteomicScan Technologies
    { first_name: 'Dr. Claire', last_name: 'Foster', email: 'c.foster@proteomicscan.com', job_title: 'CSO & Co-Founder', seniority_level: 'C_SUITE', department: 'RD', jf: 'Research & Development', company: 'ProteomicScan Technologies', country: 'United States', city: 'San Diego', region: 'us', engagement_score: 79, is_verified: true, tags: ['proteomics', 'founder', 'KOL'] },
    // TrialSpark Innovations
    { first_name: 'Isabella', last_name: 'Romano', email: 'i.romano@trialspark.com', job_title: 'CEO', seniority_level: 'C_SUITE', department: 'EXECUTIVE_LEADERSHIP', jf: 'Strategy / Corporate Development', company: 'TrialSpark Innovations', country: 'United States', city: 'New York', region: 'us', engagement_score: 82, is_verified: true, tags: ['dct', 'founder', 'WHAI NY 2025'] },
    // PathBio Manufacturing
    { first_name: 'Vijay', last_name: 'Sharma', email: 'v.sharma@pathbio.in', job_title: 'Managing Director', seniority_level: 'C_SUITE', department: 'OPERATIONS', jf: 'Operations', company: 'PathBio Manufacturing', country: 'India', city: 'Hyderabad', region: 'india', engagement_score: 64, is_verified: true, tags: ['cdmo', 'api', 'india'] },
    // RealEvidence Analytics
    { first_name: 'Dr. Sophie', last_name: 'Beaumont', email: 's.beaumont@realevidence.co.uk', job_title: 'Managing Director', seniority_level: 'C_SUITE', department: 'STRATEGY', jf: 'Research & Development', company: 'RealEvidence Analytics', country: 'United Kingdom', city: 'Oxford', region: 'uk', engagement_score: 81, is_verified: true, tags: ['rwe', 'heor', 'KOL', 'speaker'] },
    { first_name: 'Peter', last_name: 'Van Der Berg', email: 'p.vanderberg@realevidence.co.uk', job_title: 'Director, Health Economics', seniority_level: 'DIRECTOR', department: 'STRATEGY', jf: 'Research & Development', company: 'RealEvidence Analytics', country: 'Netherlands', city: 'Amsterdam', region: 'netherlands', engagement_score: 55, is_verified: false, tags: ['health-economics'] },
    // CytaPath Therapeutics
    { first_name: 'Dr. Nathan', last_name: 'Goldstein', email: 'n.goldstein@cytapath.com', job_title: 'CEO & Founder', seniority_level: 'C_SUITE', department: 'EXECUTIVE_LEADERSHIP', jf: 'Strategy / Corporate Development', company: 'CytaPath Therapeutics', country: 'United States', city: 'San Diego', region: 'us', engagement_score: 87, is_verified: true, tags: ['car-t', 'founder', 'speaker'] },
    { first_name: 'Emma', last_name: 'Kowalski', email: 'e.kowalski@cytapath.com', job_title: 'VP Clinical Development', seniority_level: 'VP', department: 'CLINICAL', jf: 'Clinical / Medical Affairs', company: 'CytaPath Therapeutics', country: 'United States', city: 'San Diego', region: 'us', engagement_score: 68, is_verified: true, tags: ['haematology'] },
    // MedSynth Biologics
    { first_name: 'Dr. Wolfgang', last_name: 'Fischer', email: 'w.fischer@medsynth.de', job_title: 'Chief Scientific Officer', seniority_level: 'C_SUITE', department: 'RD', jf: 'Research & Development', company: 'MedSynth Biologics', country: 'Germany', city: 'Munich', region: 'germany', engagement_score: 75, is_verified: true, tags: ['biosimilars', 'biologics'] },
    // Vericel Genomics
    { first_name: 'Dr. Abby', last_name: 'Harrison', email: 'a.harrison@vericelgenomics.com', job_title: 'CEO & Co-Founder', seniority_level: 'C_SUITE', department: 'EXECUTIVE_LEADERSHIP', jf: 'Research & Development', company: 'Vericel Genomics', country: 'United States', city: 'San Francisco', region: 'us', engagement_score: 84, is_verified: true, tags: ['crispr', 'rare-disease', 'founder'] },
    // OncoBridge Sciences
    { first_name: 'Dr. Carlos', last_name: 'Reyes', email: 'c.reyes@oncobridge.com', job_title: 'Chief Executive Officer', seniority_level: 'C_SUITE', department: 'EXECUTIVE_LEADERSHIP', jf: 'Strategy / Corporate Development', company: 'OncoBridge Sciences', country: 'United States', city: 'Houston', region: 'us', engagement_score: 76, is_verified: true, tags: ['adc', 'oncology', 'founder'] },
    // Pangolin Pharma
    { first_name: 'Dr. François', last_name: 'Mercier', email: 'f.mercier@pangolin.ch', job_title: 'Medical Director', seniority_level: 'C_SUITE', department: 'CLINICAL', jf: 'Clinical / Medical Affairs', company: 'Pangolin Pharma', country: 'Switzerland', city: 'Basel', region: 'switzerland', engagement_score: 72, is_verified: true, tags: ['respiratory', 'specialty-pharma'] },
    // SynthoGene Therapeutics
    { first_name: 'Dr. Oren', last_name: 'Mizrahi', email: 'o.mizrahi@synthogene.io', job_title: 'CEO & Co-Founder', seniority_level: 'C_SUITE', department: 'EXECUTIVE_LEADERSHIP', jf: 'Research & Development', company: 'SynthoGene Therapeutics', country: 'Israel', city: 'Tel Aviv', region: 'israel', engagement_score: 80, is_verified: true, tags: ['rna', 'stealth-mode', 'founder'] },
    // Meridian Biopharma
    { first_name: 'Dr. Hilde', last_name: 'Van Oss', email: 'h.vanoss@meridian-bio.com', job_title: 'VP Vaccines R&D', seniority_level: 'VP', department: 'RD', jf: 'Research & Development', company: 'Meridian Biopharma', country: 'Netherlands', city: 'Amsterdam', region: 'netherlands', engagement_score: 70, is_verified: true, tags: ['vaccines', 'r&d'] },
    // PinPoint Bioventures
    { first_name: 'Cassandra', last_name: 'Liu', email: 'c.liu@pinpointbio.vc', job_title: 'Partner', seniority_level: 'C_SUITE', department: 'FINANCE', jf: 'Investor Relations', company: 'PinPoint Bioventures', country: 'United States', city: 'Boston', region: 'us', engagement_score: 79, is_verified: true, tags: ['vc', 'oncology-investor', 'WHAI Boston 2026'] },
    // Vantage Health Growth Partners
    { first_name: 'Stephen', last_name: 'Crawford', email: 's.crawford@vantagehgp.com', job_title: 'Managing Director', seniority_level: 'C_SUITE', department: 'FINANCE', jf: 'Investor Relations', company: 'Vantage Health Growth Partners', country: 'United States', city: 'New York', region: 'us', engagement_score: 76, is_verified: true, tags: ['growth-equity', 'health-it'] },
    // Horizon MedTech Fund
    { first_name: 'Dr. Lukas', last_name: 'Maurer', email: 'l.maurer@horizonmedtech.de', job_title: 'Managing Partner', seniority_level: 'C_SUITE', department: 'FINANCE', jf: 'Investor Relations', company: 'Horizon MedTech Fund', country: 'Germany', city: 'Berlin', region: 'germany', engagement_score: 73, is_verified: true, tags: ['medtech-vc', 'europe'] },
    // BioStrategy Partners
    { first_name: 'Dr. Andrée', last_name: 'Keller', email: 'a.keller@biostrategy.ch', job_title: 'Senior Partner', seniority_level: 'C_SUITE', department: 'STRATEGY', jf: 'Strategy / Corporate Development', company: 'BioStrategy Partners', country: 'Switzerland', city: 'Zurich', region: 'switzerland', engagement_score: 78, is_verified: true, tags: ['ma-advisory', 'life-sciences', 'speaker'] },
    // PrecisionPath Consulting
    { first_name: 'Dr. Alison', last_name: 'Tran', email: 'a.tran@precisionpath.health', job_title: 'Founding Partner', seniority_level: 'C_SUITE', department: 'STRATEGY', jf: 'Strategy / Corporate Development', company: 'PrecisionPath Consulting', country: 'United States', city: 'San Francisco', region: 'us', engagement_score: 82, is_verified: true, tags: ['precision-medicine', 'founder', 'KOL'] },
    // Global Health Economics
    { first_name: 'Dr. Helen', last_name: 'Pearce', email: 'h.pearce@gheconomics.co.uk', job_title: 'Chief Executive', seniority_level: 'C_SUITE', department: 'STRATEGY', jf: 'Research & Development', company: 'Global Health Economics Ltd', country: 'United Kingdom', city: 'Manchester', region: 'uk', engagement_score: 75, is_verified: true, tags: ['heor', 'hta', 'KOL'] },
    // CareFirst Ambulatory
    { first_name: 'Brenda', last_name: 'Simmons', email: 'b.simmons@carefirst.health', job_title: 'Chief Operating Officer', seniority_level: 'C_SUITE', department: 'OPERATIONS', jf: 'Operations', company: 'CareFirst Ambulatory Group', country: 'United States', city: 'Dallas', region: 'us', engagement_score: 67, is_verified: true, tags: ['ambulatory', 'pe-backed'] },
    // SingHealth
    { first_name: 'Prof. Andrew', last_name: 'Tan', email: 'a.tan@singhealth.com.sg', job_title: 'Group CEO', seniority_level: 'C_SUITE', department: 'EXECUTIVE_LEADERSHIP', jf: 'Strategy / Corporate Development', company: 'SingHealth Academic Medical Centre', country: 'Singapore', city: 'Singapore', region: 'singapore', engagement_score: 80, is_verified: true, tags: ['academic-medical', 'singapore', 'KOL'] },
    { first_name: 'Dr. Lin', last_name: 'Wei', email: 'l.wei@singhealth.com.sg', job_title: 'Head of Digital Innovation', seniority_level: 'DIRECTOR', department: 'IT_DIGITAL', jf: 'Digital Health / Innovation', company: 'SingHealth Academic Medical Centre', country: 'Singapore', city: 'Singapore', region: 'singapore', engagement_score: 65, is_verified: true, tags: ['digital-health', 'apac'] },
    // MindWell
    { first_name: 'Rachel', last_name: 'Stone', email: 'r.stone@mindwell.health', job_title: 'Chief Executive Officer', seniority_level: 'C_SUITE', department: 'EXECUTIVE_LEADERSHIP', jf: 'Strategy / Corporate Development', company: 'MindWell Behavioural Health', country: 'United States', city: 'Denver', region: 'us', engagement_score: 85, is_verified: true, tags: ['mental-health', 'employer-health', 'founder'] },
    { first_name: 'Jordan', last_name: 'Maxwell', email: 'j.maxwell@mindwell.health', job_title: 'VP Clinical Programs', seniority_level: 'VP', department: 'CLINICAL', jf: 'Clinical / Medical Affairs', company: 'MindWell Behavioural Health', country: 'United States', city: 'Denver', region: 'us', engagement_score: 60, is_verified: true, tags: ['psychology', 'telehealth'] },
    // US FDA
    { first_name: 'Dr. Patricia', last_name: 'Morgan', email: 'p.morgan@fda.gov', job_title: 'Deputy Commissioner for Drug Evaluation', seniority_level: 'C_SUITE', department: 'REGULATORY', jf: 'Regulatory Affairs', company: 'US FDA Center for Drug Evaluation', country: 'United States', city: 'Silver Spring', region: 'us', engagement_score: 88, is_verified: true, tags: ['FDA', 'KOL', 'regulatory', 'speaker'] },
    // EMA
    { first_name: 'Dr. Joachim', last_name: 'Müller', email: 'j.muller@ema.europa.eu', job_title: 'Head of Oncology Evaluation', seniority_level: 'DIRECTOR', department: 'REGULATORY', jf: 'Regulatory Affairs', company: 'European Medicines Agency (EMA)', country: 'Netherlands', city: 'Amsterdam', region: 'netherlands', engagement_score: 82, is_verified: true, tags: ['EMA', 'regulatory', 'oncology', 'KOL'] },
    // Healthcare Innovation Alliance
    { first_name: 'Rebecca', last_name: 'Foster', email: 'r.foster@hcinnovation.org', job_title: 'President & CEO', seniority_level: 'C_SUITE', department: 'STRATEGY', jf: 'Government Affairs / Policy', company: 'Healthcare Innovation Alliance', country: 'United States', city: 'Washington', region: 'us', engagement_score: 86, is_verified: true, tags: ['health-it-policy', 'speaker', 'whai-board'] },
    // WHIS
    { first_name: 'Sheikh Abdullah', last_name: 'Al-Rashidi', email: 'a.alrashidi@whis.ae', job_title: 'Secretary General', seniority_level: 'C_SUITE', department: 'EXECUTIVE_LEADERSHIP', jf: 'Government Affairs / Policy', company: 'World Health Innovation Summit (WHIS)', country: 'UAE', city: 'Dubai', region: 'uae', engagement_score: 79, is_verified: true, tags: ['uae', 'global-health', 'events'] },
    // Additional contacts for more populated companies
    { first_name: 'Nina', last_name: 'Hoffman', email: 'n.hoffman@novamedica.com', job_title: 'Director, Global Medical Affairs', seniority_level: 'DIRECTOR', department: 'CLINICAL', jf: 'Clinical / Medical Affairs', company: 'NovaMedica Therapeutics', country: 'United States', city: 'Cambridge', region: 'us', engagement_score: 58, is_verified: true, tags: [] },
    { first_name: 'Lucas', last_name: 'Rivera', email: 'l.rivera@novamedica.com', job_title: 'VP Finance', seniority_level: 'VP', department: 'FINANCE', jf: 'Finance / Accounting', company: 'NovaMedica Therapeutics', country: 'United States', city: 'Cambridge', region: 'us', engagement_score: 44, is_verified: false, tags: [] },
    { first_name: 'Diana', last_name: 'Frey', email: 'd.frey@praxiscro.com', job_title: 'VP Clinical Operations', seniority_level: 'VP', department: 'OPERATIONS', jf: 'Operations', company: 'Praxis Clinical Research', country: 'United States', city: 'Raleigh', region: 'us', engagement_score: 56, is_verified: true, tags: [] },
    { first_name: 'Tim', last_name: 'Bourke', email: 't.bourke@meridianhealth.org', job_title: 'Director, Population Health', seniority_level: 'DIRECTOR', department: 'STRATEGY', jf: 'Strategy / Corporate Development', company: 'Meridian Health Network', country: 'United States', city: 'Philadelphia', region: 'us', engagement_score: 55, is_verified: false, tags: [] },
    { first_name: 'Ana', last_name: 'Vargas', email: 'a.vargas@luminexhealth.com', job_title: 'Director, Customer Success', seniority_level: 'DIRECTOR', department: 'COMMERCIAL', jf: 'Commercial / Sales', company: 'Luminex Health Technologies', country: 'United States', city: 'Chicago', region: 'us', engagement_score: 50, is_verified: false, tags: [] },
    { first_name: 'James', last_name: 'Ngozi', email: 'j.ngozi@sovereignhc.com', job_title: 'Associate Director, Healthcare Services', seniority_level: 'MANAGER', department: 'FINANCE', jf: 'Investor Relations', company: 'Sovereign Healthcare Capital', country: 'United Kingdom', city: 'London', region: 'uk', engagement_score: 42, is_verified: false, tags: [] },
    { first_name: 'Petra', last_name: 'Hofer', email: 'p.hofer@biomanufact.ch', job_title: 'Quality Director', seniority_level: 'DIRECTOR', department: 'OPERATIONS', jf: 'Quality Assurance', company: 'BioManufact Partners', country: 'Switzerland', city: 'Zurich', region: 'switzerland', engagement_score: 46, is_verified: true, tags: [] },
    { first_name: 'Anthony', last_name: 'Blake', email: 'a.blake@helixpharma.co.uk', job_title: 'Head of Investor Relations', seniority_level: 'DIRECTOR', department: 'FINANCE', jf: 'Investor Relations', company: 'Helix Pharma Group', country: 'United Kingdom', city: 'London', region: 'uk', engagement_score: 40, is_verified: false, tags: [] },
    { first_name: 'Sandra', last_name: 'Obi', email: 's.obi@nhsgreatlondon.nhs.uk', job_title: 'Head of Data & Analytics', seniority_level: 'DIRECTOR', department: 'IT_DIGITAL', jf: 'Information Technology', company: 'NHS Greater London Trust', country: 'United Kingdom', city: 'London', region: 'uk', engagement_score: 59, is_verified: false, tags: [] },
    { first_name: 'Laura', last_name: 'Santos', email: 'l.santos@cytapath.com', job_title: 'Director, Regulatory Affairs', seniority_level: 'DIRECTOR', department: 'REGULATORY', jf: 'Regulatory Affairs', company: 'CytaPath Therapeutics', country: 'United States', city: 'San Diego', region: 'us', engagement_score: 53, is_verified: true, tags: [] },
    { first_name: 'Patrick', last_name: 'Quinn', email: 'p.quinn@meridianadvisors.com', job_title: 'Partner, Commercial Strategy', seniority_level: 'MANAGER', department: 'STRATEGY', jf: 'Strategy / Corporate Development', company: 'Meridian Health Advisors', country: 'United States', city: 'Washington', region: 'us', engagement_score: 47, is_verified: false, tags: [] },
    { first_name: 'Nadia', last_name: 'Petrov', email: 'n.petrov@quantishealth.ai', job_title: 'VP Engineering', seniority_level: 'VP', department: 'IT_DIGITAL', jf: 'Information Technology', company: 'Quantis Health Intelligence', country: 'United States', city: 'Boston', region: 'us', engagement_score: 61, is_verified: false, tags: [] },
    { first_name: 'Owen', last_name: 'Murphy', email: 'o.murphy@healthtechinsights.co.uk', job_title: 'Senior Consultant', seniority_level: 'INDIVIDUAL_CONTRIBUTOR', department: 'STRATEGY', jf: 'Strategy / Corporate Development', company: 'HealthTech Insights Group', country: 'United Kingdom', city: 'London', region: 'uk', engagement_score: 38, is_verified: false, tags: [] },
    { first_name: 'Caroline', last_name: 'Johansson', email: 'c.johansson@biosignal.se', job_title: 'Head of Regulatory Affairs', seniority_level: 'DIRECTOR', department: 'REGULATORY', jf: 'Regulatory Affairs', company: 'BioSignal Wearables', country: 'Sweden', city: 'Stockholm', region: 'sweden', engagement_score: 49, is_verified: false, tags: [] },
    { first_name: 'Liam', last_name: 'Zhang', email: 'l.zhang@axiombio.com', job_title: 'Business Development Manager', seniority_level: 'MANAGER', department: 'COMMERCIAL', jf: 'Business Development / Partnerships', company: 'Axiom Biosciences', country: 'United States', city: 'Boston', region: 'us', engagement_score: 44, is_verified: false, tags: [] },
    { first_name: 'Amelia', last_name: 'Brown', email: 'a.brown@apogeehv.com', job_title: 'Principal', seniority_level: 'MANAGER', department: 'FINANCE', jf: 'Investor Relations', company: 'Apogee Health Ventures', country: 'United States', city: 'San Francisco', region: 'us', engagement_score: 57, is_verified: true, tags: [] },
    { first_name: 'Kwame', last_name: 'Asante', email: 'k.asante@realevidence.co.uk', job_title: 'Senior Health Economist', seniority_level: 'INDIVIDUAL_CONTRIBUTOR', department: 'STRATEGY', jf: 'Research & Development', company: 'RealEvidence Analytics', country: 'United Kingdom', city: 'Oxford', region: 'uk', engagement_score: 41, is_verified: false, tags: [] },
    { first_name: 'Isabelle', last_name: 'Fontaine', email: 'i.fontaine@biostrategy.ch', job_title: 'Senior Manager, Strategy', seniority_level: 'MANAGER', department: 'STRATEGY', jf: 'Strategy / Corporate Development', company: 'BioStrategy Partners', country: 'France', city: 'Paris', region: 'france', engagement_score: 46, is_verified: false, tags: [] },
    { first_name: 'Connor', last_name: 'Walsh', email: 'c.walsh@carefirst.health', job_title: 'VP Payor Relations', seniority_level: 'VP', department: 'COMMERCIAL', jf: 'Commercial / Sales', company: 'CareFirst Ambulatory Group', country: 'United States', city: 'Dallas', region: 'us', engagement_score: 53, is_verified: false, tags: [] },
    { first_name: 'Anna', last_name: 'Kostadinova', email: 'a.kostadinova@medsynth.de', job_title: 'VP Commercial, Eastern Europe', seniority_level: 'VP', department: 'COMMERCIAL', jf: 'Commercial / Sales', company: 'MedSynth Biologics', country: 'Germany', city: 'Munich', region: 'germany', engagement_score: 60, is_verified: true, tags: ['biosimilars', 'eastern-europe'] },
    { first_name: 'Ben', last_name: 'Hawkins', email: 'b.hawkins@trialspark.com', job_title: 'VP Partnerships', seniority_level: 'VP', department: 'COMMERCIAL', jf: 'Business Development / Partnerships', company: 'TrialSpark Innovations', country: 'United States', city: 'New York', region: 'us', engagement_score: 59, is_verified: true, tags: ['dct', 'partnerships'] },
    { first_name: 'Daria', last_name: 'Volkova', email: 'd.volkova@gheconomics.co.uk', job_title: 'Director, HTA Strategy', seniority_level: 'DIRECTOR', department: 'STRATEGY', jf: 'Research & Development', company: 'Global Health Economics Ltd', country: 'United Kingdom', city: 'Manchester', region: 'uk', engagement_score: 58, is_verified: true, tags: ['hta', 'nice'] },
    { first_name: 'Marco', last_name: 'Ferrari', email: 'm.ferrari@pangolin.ch', job_title: 'VP Commercial, Southern Europe', seniority_level: 'VP', department: 'COMMERCIAL', jf: 'Commercial / Sales', company: 'Pangolin Pharma', country: 'Switzerland', city: 'Basel', region: 'switzerland', engagement_score: 51, is_verified: false, tags: [] },
    { first_name: 'Zoe', last_name: 'Taylor', email: 'z.taylor@digital.nhs.uk', job_title: 'Senior Programme Manager', seniority_level: 'MANAGER', department: 'IT_DIGITAL', jf: 'Digital Health / Innovation', company: 'NHS England Digital', country: 'United Kingdom', city: 'London', region: 'uk', engagement_score: 55, is_verified: false, tags: [] },
    { first_name: 'Arnav', last_name: 'Chopra', email: 'a.chopra@pathbio.in', job_title: 'Head of Business Development', seniority_level: 'DIRECTOR', department: 'COMMERCIAL', jf: 'Business Development / Partnerships', company: 'PathBio Manufacturing', country: 'India', city: 'Hyderabad', region: 'india', engagement_score: 50, is_verified: false, tags: [] },
    { first_name: 'Nora', last_name: 'Jensen', email: 'n.jensen@pinpointbio.vc', job_title: 'Analyst', seniority_level: 'INDIVIDUAL_CONTRIBUTOR', department: 'FINANCE', jf: 'Investor Relations', company: 'PinPoint Bioventures', country: 'United States', city: 'Boston', region: 'us', engagement_score: 36, is_verified: false, tags: [] },
    { first_name: 'George', last_name: 'Patterson', email: 'g.patterson@vantagehgp.com', job_title: 'Vice President', seniority_level: 'VP', department: 'FINANCE', jf: 'Investor Relations', company: 'Vantage Health Growth Partners', country: 'United States', city: 'New York', region: 'us', engagement_score: 62, is_verified: true, tags: ['growth-equity'] },
    { first_name: 'Chiara', last_name: 'Lombardi', email: 'c.lombardi@horizonmedtech.de', job_title: 'Associate', seniority_level: 'INDIVIDUAL_CONTRIBUTOR', department: 'FINANCE', jf: 'Investor Relations', company: 'Horizon MedTech Fund', country: 'Germany', city: 'Berlin', region: 'germany', engagement_score: 38, is_verified: false, tags: [] },
    { first_name: 'Paul', last_name: 'Eriksson', email: 'p.eriksson@vericelgenomics.com', job_title: 'Head of IP & Legal', seniority_level: 'DIRECTOR', department: 'STRATEGY', jf: 'Legal / Compliance', company: 'Vericel Genomics', country: 'United States', city: 'San Francisco', region: 'us', engagement_score: 42, is_verified: false, tags: [] },
    { first_name: 'Mia', last_name: 'Andersen', email: 'm.andersen@oncobridge.com', job_title: 'VP Finance & Operations', seniority_level: 'VP', department: 'FINANCE', jf: 'Finance / Accounting', company: 'OncoBridge Sciences', country: 'United States', city: 'Houston', region: 'us', engagement_score: 48, is_verified: false, tags: [] },
    { first_name: 'Ravi', last_name: 'Desai', email: 'r.desai@synapse.ai', job_title: 'Head of Customer Success', seniority_level: 'MANAGER', department: 'COMMERCIAL', jf: 'Commercial / Sales', company: 'Synapse Clinical AI', country: 'Singapore', city: 'Singapore', region: 'singapore', engagement_score: 55, is_verified: false, tags: [] },
    { first_name: 'Lily', last_name: 'Nguyen', email: 'l.nguyen@connectcare.com.au', job_title: 'CTO', seniority_level: 'C_SUITE', department: 'IT_DIGITAL', jf: 'Information Technology', company: 'ConnectCare Platforms', country: 'Australia', city: 'Sydney', region: 'australia', engagement_score: 68, is_verified: true, tags: ['cto', 'australia'] },
    { first_name: 'Aaron', last_name: 'Spencer', email: 'a.spencer@healthflowanalytics.com', job_title: 'Director of Sales', seniority_level: 'DIRECTOR', department: 'COMMERCIAL', jf: 'Commercial / Sales', company: 'HealthFlow Analytics', country: 'United States', city: 'Atlanta', region: 'us', engagement_score: 52, is_verified: false, tags: [] },
    { first_name: 'Fumiko', last_name: 'Hashimoto', email: 'f.hashimoto@optivision.co.jp', job_title: 'VP International Business', seniority_level: 'VP', department: 'COMMERCIAL', jf: 'Commercial / Sales', company: 'OptiVision Ophthalmics', country: 'Japan', city: 'Tokyo', region: 'japan', engagement_score: 59, is_verified: false, tags: [] },
    { first_name: 'Nathan', last_name: 'Brooks', email: 'n.brooks@kineticsurgical.com', job_title: 'Director, Clinical Education', seniority_level: 'DIRECTOR', department: 'CLINICAL', jf: 'Clinical / Medical Affairs', company: 'Kinetic Surgical Technologies', country: 'United States', city: 'Austin', region: 'us', engagement_score: 55, is_verified: false, tags: [] },
    { first_name: 'Tobias', last_name: 'Richter', email: 't.richter@diagnopath.de', job_title: 'VP Sales, EMEA', seniority_level: 'VP', department: 'COMMERCIAL', jf: 'Commercial / Sales', company: 'DiagnoPath IVD', country: 'Germany', city: 'Heidelberg', region: 'germany', engagement_score: 54, is_verified: false, tags: [] },
    { first_name: 'Elise', last_name: 'Dupont', email: 'e.dupont@precisionpath.health', job_title: 'Senior Consultant', seniority_level: 'INDIVIDUAL_CONTRIBUTOR', department: 'STRATEGY', jf: 'Research & Development', company: 'PrecisionPath Consulting', country: 'United States', city: 'San Francisco', region: 'us', engagement_score: 45, is_verified: false, tags: [] },
    { first_name: 'Steven', last_name: 'Ho', email: 's.ho@singhealth.com.sg', job_title: 'Director of Oncology', seniority_level: 'DIRECTOR', department: 'CLINICAL', jf: 'Clinical / Medical Affairs', company: 'SingHealth Academic Medical Centre', country: 'Singapore', city: 'Singapore', region: 'singapore', engagement_score: 63, is_verified: true, tags: ['oncology', 'KOL'] },
    { first_name: 'Katie', last_name: 'Donovan', email: 'k.donovan@hcinnovation.org', job_title: 'VP Policy & Government Affairs', seniority_level: 'VP', department: 'STRATEGY', jf: 'Government Affairs / Policy', company: 'Healthcare Innovation Alliance', country: 'United States', city: 'Washington', region: 'us', engagement_score: 70, is_verified: true, tags: ['policy', 'health-it'] },
    { first_name: 'Mohammed', last_name: 'Al-Khatib', email: 'm.alkhatib@whis.ae', job_title: 'Head of Partnerships', seniority_level: 'DIRECTOR', department: 'COMMERCIAL', jf: 'Business Development / Partnerships', company: 'World Health Innovation Summit (WHIS)', country: 'UAE', city: 'Dubai', region: 'uae', engagement_score: 62, is_verified: false, tags: ['uae', 'partnerships'] },
    { first_name: 'Monica', last_name: 'Reinholt', email: 'm.reinholt@meridian-bio.com', job_title: 'Director, Corporate Development', seniority_level: 'DIRECTOR', department: 'STRATEGY', jf: 'Business Development / Partnerships', company: 'Meridian Biopharma', country: 'Netherlands', city: 'Amsterdam', region: 'netherlands', engagement_score: 57, is_verified: false, tags: [] },
    { first_name: 'Darren', last_name: 'Fielding', email: 'd.fielding@carestream.digital', job_title: 'Head of Clinical Partnerships', seniority_level: 'DIRECTOR', department: 'COMMERCIAL', jf: 'Business Development / Partnerships', company: 'CareStream Digital Health', country: 'United States', city: 'New York', region: 'us', engagement_score: 63, is_verified: true, tags: ['telehealth', 'partnerships'] },
    { first_name: 'Sophia', last_name: 'Cohen', email: 's.cohen@mindwell.health', job_title: 'Head of Therapy Programs', seniority_level: 'MANAGER', department: 'CLINICAL', jf: 'Clinical / Medical Affairs', company: 'MindWell Behavioural Health', country: 'United States', city: 'Denver', region: 'us', engagement_score: 50, is_verified: false, tags: ['psychology'] },
    { first_name: 'Oluwaseun', last_name: 'Adebayo', email: 'o.adebayo@proteomicscan.com', job_title: 'Bioinformatics Scientist', seniority_level: 'INDIVIDUAL_CONTRIBUTOR', department: 'RD', jf: 'Data Science / AI / Machine Learning', company: 'ProteomicScan Technologies', country: 'United States', city: 'San Diego', region: 'us', engagement_score: 39, is_verified: false, tags: [] },
    { first_name: 'Eleanor', last_name: 'Hughes', email: 'e.hughes@nexgenhx.com', job_title: 'VP Customer Success', seniority_level: 'VP', department: 'COMMERCIAL', jf: 'Commercial / Sales', company: 'NexGen Health Exchange', country: 'United States', city: 'Minneapolis', region: 'us', engagement_score: 55, is_verified: false, tags: ['hie'] },
    { first_name: 'Adam', last_name: 'Rossi', email: 'a.rossi@cardiosense.io', job_title: 'Head of Clinical Affairs', seniority_level: 'DIRECTOR', department: 'CLINICAL', jf: 'Clinical / Medical Affairs', company: 'CardioSense Devices', country: 'United States', city: 'Minneapolis', region: 'us', engagement_score: 58, is_verified: true, tags: ['cardiac', 'clinical-affairs'] },
    { first_name: 'Hana', last_name: 'Nakagawa', email: 'h.nakagawa@synthogene.io', job_title: 'Head of Preclinical', seniority_level: 'DIRECTOR', department: 'RD', jf: 'Research & Development', company: 'SynthoGene Therapeutics', country: 'Israel', city: 'Tel Aviv', region: 'israel', engagement_score: 52, is_verified: false, tags: ['rna'] },
    { first_name: 'Michael', last_name: 'Oduya', email: 'm.oduya@patientpath.com', job_title: 'VP Implementation', seniority_level: 'VP', department: 'OPERATIONS', jf: 'Operations', company: 'PatientPath Technologies', country: 'United States', city: 'Nashville', region: 'us', engagement_score: 48, is_verified: false, tags: [] },
    { first_name: 'Cecilia', last_name: 'Alvarez', email: 'c.alvarez@oncobridge.com', job_title: 'Director, Medical Affairs', seniority_level: 'DIRECTOR', department: 'CLINICAL', jf: 'Clinical / Medical Affairs', company: 'OncoBridge Sciences', country: 'United States', city: 'Houston', region: 'us', engagement_score: 55, is_verified: false, tags: ['oncology', 'adc'] },

    // Additional contacts batch 2 — more depth per company
    // NovaMedica Therapeutics (adding 2 more for large pharma)
    { first_name: 'Rebecca', last_name: 'Mason', email: 'r.mason@novamedica.com', job_title: 'VP Global Marketing, Oncology', seniority_level: 'VP', department: 'COMMERCIAL', jf: 'Marketing', company: 'NovaMedica Therapeutics', country: 'United States', city: 'Cambridge', region: 'us', engagement_score: 61, is_verified: true, tags: ['oncology', 'marketing'] },
    { first_name: 'Wei', last_name: 'Zhang', email: 'w.zhang@novamedica.com', job_title: 'Associate Director, Clinical Operations', seniority_level: 'MANAGER', department: 'CLINICAL', jf: 'Clinical / Medical Affairs', company: 'NovaMedica Therapeutics', country: 'United States', city: 'Cambridge', region: 'us', engagement_score: 45, is_verified: false, tags: [] },
    // Helix Pharma Group (adding 2 more)
    { first_name: 'Siobhan', last_name: "O'Neill", email: 's.oneill@helixpharma.co.uk', job_title: 'Head of Medical Affairs, CNS', seniority_level: 'DIRECTOR', department: 'CLINICAL', jf: 'Clinical / Medical Affairs', company: 'Helix Pharma Group', country: 'United Kingdom', city: 'London', region: 'uk', engagement_score: 57, is_verified: true, tags: ['cns', 'medical-affairs'] },
    { first_name: 'Bruno', last_name: 'Laroche', email: 'b.laroche@helixpharma.co.uk', job_title: 'Director, Supply Chain Operations', seniority_level: 'DIRECTOR', department: 'OPERATIONS', jf: 'Supply Chain / Manufacturing', company: 'Helix Pharma Group', country: 'France', city: 'Lyon', region: 'france', engagement_score: 38, is_verified: false, tags: [] },
    // Praxis Clinical Research (adding 2 more for global CRO)
    { first_name: 'Aaliya', last_name: 'Bose', email: 'a.bose@praxiscro.com', job_title: 'Director, Patient Recruitment', seniority_level: 'DIRECTOR', department: 'CLINICAL', jf: 'Clinical / Medical Affairs', company: 'Praxis Clinical Research', country: 'India', city: 'Mumbai', region: 'india', engagement_score: 49, is_verified: false, tags: ['patient-recruitment'] },
    { first_name: 'François', last_name: 'Girard', email: 'f.girard@praxiscro.com', job_title: 'VP Business Development, Europe', seniority_level: 'VP', department: 'COMMERCIAL', jf: 'Business Development / Partnerships', company: 'Praxis Clinical Research', country: 'France', city: 'Paris', region: 'france', engagement_score: 55, is_verified: true, tags: ['european-cro', 'bd'] },
    // Meridian Health Network (adding 2 more for large health system)
    { first_name: 'Tyrone', last_name: 'Jefferson', email: 't.jefferson@meridianhealth.org', job_title: 'CFO', seniority_level: 'C_SUITE', department: 'FINANCE', jf: 'Finance / Accounting', company: 'Meridian Health Network', country: 'United States', city: 'Philadelphia', region: 'us', engagement_score: 60, is_verified: true, tags: ['finance', 'health-system'] },
    { first_name: 'Anjali', last_name: 'Mehta', email: 'a.mehta@meridianhealth.org', job_title: 'Director, Quality Improvement', seniority_level: 'DIRECTOR', department: 'OPERATIONS', jf: 'Quality Assurance', company: 'Meridian Health Network', country: 'United States', city: 'Philadelphia', region: 'us', engagement_score: 46, is_verified: false, tags: [] },
    // NHS Greater London Trust (adding 1 more)
    { first_name: 'Rosemary', last_name: 'Clarke', email: 'r.clarke@nhsgreatlondon.nhs.uk', job_title: 'Deputy Chief Nurse', seniority_level: 'DIRECTOR', department: 'CLINICAL', jf: 'Clinical / Medical Affairs', company: 'NHS Greater London Trust', country: 'United Kingdom', city: 'London', region: 'uk', engagement_score: 43, is_verified: false, tags: [] },
    // Luminex Health Technologies (adding 1 more)
    { first_name: 'Darius', last_name: 'Webb', email: 'd.webb@luminexhealth.com', job_title: 'Head of Sales, Health Systems', seniority_level: 'DIRECTOR', department: 'COMMERCIAL', jf: 'Commercial / Sales', company: 'Luminex Health Technologies', country: 'United States', city: 'Chicago', region: 'us', engagement_score: 53, is_verified: false, tags: [] },
    // CareStream Digital Health (adding 2 more)
    { first_name: 'Vivian', last_name: 'Okafor', email: 'v.okafor@carestream.digital', job_title: 'Head of Clinical Quality', seniority_level: 'DIRECTOR', department: 'CLINICAL', jf: 'Clinical / Medical Affairs', company: 'CareStream Digital Health', country: 'United States', city: 'New York', region: 'us', engagement_score: 52, is_verified: false, tags: [] },
    { first_name: 'Ivan', last_name: 'Petrov', email: 'i.petrov@carestream.digital', job_title: 'Senior Software Engineer', seniority_level: 'INDIVIDUAL_CONTRIBUTOR', department: 'IT_DIGITAL', jf: 'Information Technology', company: 'CareStream Digital Health', country: 'United States', city: 'New York', region: 'us', engagement_score: 31, is_verified: false, tags: [] },
    // MedAI Systems (adding 2 more)
    { first_name: 'Preethi', last_name: 'Sundar', email: 'p.sundar@medai.systems', job_title: 'VP Data Science', seniority_level: 'VP', department: 'IT_DIGITAL', jf: 'Data Science / AI / Machine Learning', company: 'MedAI Systems', country: 'United Kingdom', city: 'London', region: 'uk', engagement_score: 67, is_verified: true, tags: ['radiology-ai', 'deep-learning'] },
    { first_name: 'Jake', last_name: 'Sutherland', email: 'j.sutherland@medai.systems', job_title: 'Sales Director, UK & Ireland', seniority_level: 'DIRECTOR', department: 'COMMERCIAL', jf: 'Commercial / Sales', company: 'MedAI Systems', country: 'United Kingdom', city: 'London', region: 'uk', engagement_score: 48, is_verified: false, tags: [] },
    // BioManufact Partners (adding 1 more)
    { first_name: 'Markus', last_name: 'Hoffmann', email: 'm.hoffmann@biomanufact.ch', job_title: 'Head of Process Development', seniority_level: 'DIRECTOR', department: 'RD', jf: 'Research & Development', company: 'BioManufact Partners', country: 'Switzerland', city: 'Zurich', region: 'switzerland', engagement_score: 50, is_verified: false, tags: ['cell-therapy', 'bioprocessing'] },
    // Apogee Health Ventures (adding 1 more)
    { first_name: 'Olivia', last_name: 'Bancroft', email: 'o.bancroft@apogeehv.com', job_title: 'Analyst, Digital Health', seniority_level: 'INDIVIDUAL_CONTRIBUTOR', department: 'FINANCE', jf: 'Investor Relations', company: 'Apogee Health Ventures', country: 'United States', city: 'San Francisco', region: 'us', engagement_score: 42, is_verified: false, tags: [] },
    // Sovereign Healthcare Capital (adding 1 more)
    { first_name: 'Hugo', last_name: 'Bernier', email: 'h.bernier@sovereignhc.com', job_title: 'Senior Associate', seniority_level: 'INDIVIDUAL_CONTRIBUTOR', department: 'FINANCE', jf: 'Investor Relations', company: 'Sovereign Healthcare Capital', country: 'United Kingdom', city: 'London', region: 'uk', engagement_score: 35, is_verified: false, tags: [] },
    // Meridian Health Advisors (adding 1 more)
    { first_name: 'Catherine', last_name: 'Ingram', email: 'c.ingram@meridianadvisors.com', job_title: 'Director, Policy & Reimbursement', seniority_level: 'DIRECTOR', department: 'REGULATORY', jf: 'Regulatory Affairs', company: 'Meridian Health Advisors', country: 'United States', city: 'Washington', region: 'us', engagement_score: 55, is_verified: true, tags: ['policy', 'reimbursement'] },
    // HealthTech Insights Group (adding 1 more)
    { first_name: 'Darren', last_name: 'Tanner', email: 'd.tanner@healthtechinsights.co.uk', job_title: 'Managing Consultant', seniority_level: 'MANAGER', department: 'STRATEGY', jf: 'Strategy / Corporate Development', company: 'HealthTech Insights Group', country: 'United Kingdom', city: 'London', region: 'uk', engagement_score: 42, is_verified: false, tags: [] },
    // NHS England Digital (adding 1 more)
    { first_name: 'Barbara', last_name: 'Yates', email: 'b.yates@digital.nhs.uk', job_title: 'Senior Programme Manager, AI', seniority_level: 'MANAGER', department: 'IT_DIGITAL', jf: 'Digital Health / Innovation', company: 'NHS England Digital', country: 'United Kingdom', city: 'London', region: 'uk', engagement_score: 60, is_verified: false, tags: ['ai', 'nhs-digital'] },
    // Kinetic Surgical Technologies (adding 1 more)
    { first_name: 'Jennifer', last_name: 'Castillo', email: 'j.castillo@kineticsurgical.com', job_title: 'Director, Regulatory Affairs', seniority_level: 'DIRECTOR', department: 'REGULATORY', jf: 'Regulatory Affairs', company: 'Kinetic Surgical Technologies', country: 'United States', city: 'Austin', region: 'us', engagement_score: 47, is_verified: false, tags: [] },
    // DiagnoPath IVD (adding 2 more)
    { first_name: 'Monika', last_name: 'Steinberg', email: 'm.steinberg@diagnopath.de', job_title: 'CEO', seniority_level: 'C_SUITE', department: 'EXECUTIVE_LEADERSHIP', jf: 'Strategy / Corporate Development', company: 'DiagnoPath IVD', country: 'Germany', city: 'Heidelberg', region: 'germany', engagement_score: 80, is_verified: true, tags: ['liquid-biopsy', 'diagnostics', 'speaker'] },
    { first_name: 'Lars', last_name: 'Eriksson', email: 'l.eriksson@diagnopath.de', job_title: 'Head of Commercial, DACH', seniority_level: 'DIRECTOR', department: 'COMMERCIAL', jf: 'Commercial / Sales', company: 'DiagnoPath IVD', country: 'Germany', city: 'Heidelberg', region: 'germany', engagement_score: 44, is_verified: false, tags: [] },
    // Quantis Health Intelligence (adding 1 more)
    { first_name: 'Shreya', last_name: 'Iyer', email: 's.iyer@quantishealth.ai', job_title: 'Head of Partnerships', seniority_level: 'DIRECTOR', department: 'COMMERCIAL', jf: 'Business Development / Partnerships', company: 'Quantis Health Intelligence', country: 'United States', city: 'Boston', region: 'us', engagement_score: 58, is_verified: false, tags: ['partnerships', 'ehr-integration'] },
    // BioSignal Wearables (adding 1 more)
    { first_name: 'Lena', last_name: 'Bjork', email: 'l.bjork@biosignal.se', job_title: 'Head of Product Management', seniority_level: 'DIRECTOR', department: 'IT_DIGITAL', jf: 'Digital Health / Innovation', company: 'BioSignal Wearables', country: 'Sweden', city: 'Stockholm', region: 'sweden', engagement_score: 55, is_verified: false, tags: [] },
    // PatientPath Technologies (adding 2 more)
    { first_name: 'Marcus', last_name: 'Cooper', email: 'm.cooper@patientpath.com', job_title: 'VP Engineering', seniority_level: 'VP', department: 'IT_DIGITAL', jf: 'Information Technology', company: 'PatientPath Technologies', country: 'United States', city: 'Nashville', region: 'us', engagement_score: 57, is_verified: false, tags: [] },
    { first_name: 'Denise', last_name: 'Adkins', email: 'd.adkins@patientpath.com', job_title: 'Director, Client Services', seniority_level: 'DIRECTOR', department: 'COMMERCIAL', jf: 'Commercial / Sales', company: 'PatientPath Technologies', country: 'United States', city: 'Nashville', region: 'us', engagement_score: 43, is_verified: false, tags: [] },
    // ConnectCare Platforms (adding 1 more)
    { first_name: 'Aaron', last_name: 'Fletcher', email: 'a.fletcher@connectcare.com.au', job_title: 'VP Business Development, APAC', seniority_level: 'VP', department: 'COMMERCIAL', jf: 'Business Development / Partnerships', company: 'ConnectCare Platforms', country: 'Australia', city: 'Sydney', region: 'australia', engagement_score: 60, is_verified: false, tags: ['apac', 'partnerships'] },
    // HealthFlow Analytics (adding 2 more)
    { first_name: 'Carolyn', last_name: 'Fields', email: 'c.fields@healthflowanalytics.com', job_title: 'CEO', seniority_level: 'C_SUITE', department: 'EXECUTIVE_LEADERSHIP', jf: 'Strategy / Corporate Development', company: 'HealthFlow Analytics', country: 'United States', city: 'Atlanta', region: 'us', engagement_score: 75, is_verified: true, tags: ['population-health', 'value-based-care'] },
    { first_name: 'Joel', last_name: 'Barnes', email: 'j.barnes@healthflowanalytics.com', job_title: 'Head of Product', seniority_level: 'DIRECTOR', department: 'IT_DIGITAL', jf: 'Digital Health / Innovation', company: 'HealthFlow Analytics', country: 'United States', city: 'Atlanta', region: 'us', engagement_score: 48, is_verified: false, tags: [] },
    // Synapse Clinical AI (adding 1 more)
    { first_name: 'Tan', last_name: 'Wei Liang', email: 't.weiliang@synapse.ai', job_title: 'Head of Engineering', seniority_level: 'DIRECTOR', department: 'IT_DIGITAL', jf: 'Information Technology', company: 'Synapse Clinical AI', country: 'Singapore', city: 'Singapore', region: 'singapore', engagement_score: 52, is_verified: false, tags: ['engineering', 'apac'] },
    // NexGen Health Exchange (adding 2 more)
    { first_name: 'Raymond', last_name: 'Caldwell', email: 'r.caldwell@nexgenhx.com', job_title: 'VP Technology & Architecture', seniority_level: 'VP', department: 'IT_DIGITAL', jf: 'Information Technology', company: 'NexGen Health Exchange', country: 'United States', city: 'Minneapolis', region: 'us', engagement_score: 54, is_verified: false, tags: ['interoperability', 'fhir'] },
    { first_name: 'Grace', last_name: 'Olawale', email: 'g.olawale@nexgenhx.com', job_title: 'Director, Government Affairs', seniority_level: 'DIRECTOR', department: 'STRATEGY', jf: 'Government Affairs / Policy', company: 'NexGen Health Exchange', country: 'United States', city: 'Washington', region: 'us', engagement_score: 61, is_verified: false, tags: ['policy', 'hie'] },
    // OptiVision Ophthalmics (adding 1 more)
    { first_name: 'Takashi', last_name: 'Mori', email: 't.mori@optivision.co.jp', job_title: 'Director, Clinical Affairs', seniority_level: 'DIRECTOR', department: 'CLINICAL', jf: 'Clinical / Medical Affairs', company: 'OptiVision Ophthalmics', country: 'Japan', city: 'Tokyo', region: 'japan', engagement_score: 45, is_verified: false, tags: ['ophthalmology', 'clinical-trials'] },
    // ProteomicScan Technologies (adding 1 more)
    { first_name: 'Dana', last_name: 'Kowalczyk', email: 'd.kowalczyk@proteomicscan.com', job_title: 'Head of Sales & Business Development', seniority_level: 'DIRECTOR', department: 'COMMERCIAL', jf: 'Business Development / Partnerships', company: 'ProteomicScan Technologies', country: 'United States', city: 'San Diego', region: 'us', engagement_score: 52, is_verified: false, tags: ['proteomics', 'biopharma-sales'] },
    // TrialSpark Innovations (adding 1 more)
    { first_name: 'Philip', last_name: 'Nash', email: 'p.nash@trialspark.com', job_title: 'Head of Regulatory Affairs', seniority_level: 'DIRECTOR', department: 'REGULATORY', jf: 'Regulatory Affairs', company: 'TrialSpark Innovations', country: 'United States', city: 'New York', region: 'us', engagement_score: 47, is_verified: false, tags: ['dct', 'regulatory'] },
    // PathBio Manufacturing (adding 1 more)
    { first_name: 'Ramesh', last_name: 'Krishnan', email: 'r.krishnan@pathbio.in', job_title: 'VP Quality Assurance', seniority_level: 'VP', department: 'OPERATIONS', jf: 'Quality Assurance', company: 'PathBio Manufacturing', country: 'India', city: 'Hyderabad', region: 'india', engagement_score: 55, is_verified: true, tags: ['gmp', 'quality'] },
    // RealEvidence Analytics (adding 1 more)
    { first_name: 'Fiona', last_name: 'Stewart', email: 'f.stewart@realevidence.co.uk', job_title: 'Head of Data Science', seniority_level: 'DIRECTOR', department: 'IT_DIGITAL', jf: 'Data Science / AI / Machine Learning', company: 'RealEvidence Analytics', country: 'United Kingdom', city: 'Oxford', region: 'uk', engagement_score: 57, is_verified: false, tags: ['rwe', 'data-science'] },
    // CytaPath Therapeutics (adding 1 more)
    { first_name: 'Douglas', last_name: 'Chan', email: 'd.chan@cytapath.com', job_title: 'Director, CMC', seniority_level: 'DIRECTOR', department: 'OPERATIONS', jf: 'Supply Chain / Manufacturing', company: 'CytaPath Therapeutics', country: 'United States', city: 'San Diego', region: 'us', engagement_score: 44, is_verified: false, tags: ['car-t', 'manufacturing'] },
    // MedSynth Biologics (adding 2 more)
    { first_name: 'Claudia', last_name: 'Bauer', email: 'c.bauer@medsynth.de', job_title: 'VP Regulatory Affairs', seniority_level: 'VP', department: 'REGULATORY', jf: 'Regulatory Affairs', company: 'MedSynth Biologics', country: 'Germany', city: 'Munich', region: 'germany', engagement_score: 57, is_verified: true, tags: ['biosimilars', 'ema-regulatory'] },
    { first_name: 'Dieter', last_name: 'Kraft', email: 'd.kraft@medsynth.de', job_title: 'Head of Supply Chain', seniority_level: 'DIRECTOR', department: 'OPERATIONS', jf: 'Supply Chain / Manufacturing', company: 'MedSynth Biologics', country: 'Germany', city: 'Munich', region: 'germany', engagement_score: 40, is_verified: false, tags: [] },
    // Vericel Genomics (adding 1 more)
    { first_name: 'Noah', last_name: 'Steinfeld', email: 'n.steinfeld@vericelgenomics.com', job_title: 'Lead Scientist, Gene Editing', seniority_level: 'INDIVIDUAL_CONTRIBUTOR', department: 'RD', jf: 'Research & Development', company: 'Vericel Genomics', country: 'United States', city: 'San Francisco', region: 'us', engagement_score: 45, is_verified: false, tags: ['crispr', 'gene-editing'] },
    // OncoBridge Sciences (adding 1 more)
    { first_name: 'Teresa', last_name: 'Huang', email: 't.huang@oncobridge.com', job_title: 'Head of Translational Science', seniority_level: 'DIRECTOR', department: 'RD', jf: 'Research & Development', company: 'OncoBridge Sciences', country: 'United States', city: 'Houston', region: 'us', engagement_score: 57, is_verified: false, tags: ['adc', 'translational'] },
    // Pangolin Pharma (adding 1 more)
    { first_name: 'Ines', last_name: 'Kohler', email: 'i.kohler@pangolin.ch', job_title: 'Head of Regulatory Affairs', seniority_level: 'DIRECTOR', department: 'REGULATORY', jf: 'Regulatory Affairs', company: 'Pangolin Pharma', country: 'Switzerland', city: 'Basel', region: 'switzerland', engagement_score: 49, is_verified: false, tags: ['respiratory', 'regulatory'] },
    // SynthoGene Therapeutics (adding 1 more)
    { first_name: 'Noa', last_name: 'Ben-David', email: 'n.bendavid@synthogene.io', job_title: 'Head of Chemistry', seniority_level: 'DIRECTOR', department: 'RD', jf: 'Research & Development', company: 'SynthoGene Therapeutics', country: 'Israel', city: 'Tel Aviv', region: 'israel', engagement_score: 55, is_verified: false, tags: ['rna', 'chemistry'] },
    // Meridian Biopharma (adding 2 more)
    { first_name: 'Pieter', last_name: 'De Vries', email: 'p.devries@meridian-bio.com', job_title: 'CFO', seniority_level: 'C_SUITE', department: 'FINANCE', jf: 'Finance / Accounting', company: 'Meridian Biopharma', country: 'Netherlands', city: 'Amsterdam', region: 'netherlands', engagement_score: 62, is_verified: true, tags: ['finance', 'public-company'] },
    { first_name: 'Astrid', last_name: 'Hansen', email: 'a.hansen@meridian-bio.com', job_title: 'Director, Commercial Operations', seniority_level: 'DIRECTOR', department: 'COMMERCIAL', jf: 'Commercial / Sales', company: 'Meridian Biopharma', country: 'Netherlands', city: 'Amsterdam', region: 'netherlands', engagement_score: 48, is_verified: false, tags: ['infectious-disease', 'commercial'] },
    // CareFirst Ambulatory Group (adding 1 more)
    { first_name: 'Vincent', last_name: 'Harper', email: 'v.harper@carefirst.health', job_title: 'Medical Director', seniority_level: 'C_SUITE', department: 'CLINICAL', jf: 'Clinical / Medical Affairs', company: 'CareFirst Ambulatory Group', country: 'United States', city: 'Dallas', region: 'us', engagement_score: 63, is_verified: true, tags: ['ambulatory', 'surgery-centres'] },
    // SingHealth (adding 1 more)
    { first_name: 'Arun', last_name: 'Nambiar', email: 'a.nambiar@singhealth.com.sg', job_title: 'VP Digital Health', seniority_level: 'VP', department: 'IT_DIGITAL', jf: 'Digital Health / Innovation', company: 'SingHealth Academic Medical Centre', country: 'Singapore', city: 'Singapore', region: 'singapore', engagement_score: 68, is_verified: true, tags: ['digital-health', 'apac', 'singapore'] },
    // MindWell Behavioural Health (adding 1 more)
    { first_name: 'Alexis', last_name: 'Turner', email: 'a.turner@mindwell.health', job_title: 'Head of Employer Partnerships', seniority_level: 'DIRECTOR', department: 'COMMERCIAL', jf: 'Business Development / Partnerships', company: 'MindWell Behavioural Health', country: 'United States', city: 'Denver', region: 'us', engagement_score: 55, is_verified: false, tags: ['employer-health', 'mental-health'] },
    // US FDA Center for Drug Evaluation (adding 1 more)
    { first_name: 'Dr. Kevin', last_name: 'Bradshaw', email: 'k.bradshaw@fda.gov', job_title: 'Senior Reviewer, Biologics', seniority_level: 'INDIVIDUAL_CONTRIBUTOR', department: 'REGULATORY', jf: 'Regulatory Affairs', company: 'US FDA Center for Drug Evaluation', country: 'United States', city: 'Silver Spring', region: 'us', engagement_score: 60, is_verified: true, tags: ['FDA', 'biologics', 'regulatory'] },
    // EMA (adding 1 more)
    { first_name: 'Elena', last_name: 'Papadopoulos', email: 'e.papadopoulos@ema.europa.eu', job_title: 'Scientific Officer, Advanced Therapies', seniority_level: 'INDIVIDUAL_CONTRIBUTOR', department: 'REGULATORY', jf: 'Regulatory Affairs', company: 'European Medicines Agency (EMA)', country: 'Netherlands', city: 'Amsterdam', region: 'netherlands', engagement_score: 50, is_verified: false, tags: ['ema', 'gene-therapy', 'regulatory'] },
    // Healthcare Innovation Alliance (adding 1 more)
    { first_name: 'Derek', last_name: 'Hollins', email: 'd.hollins@hcinnovation.org', job_title: 'Director of Member Services', seniority_level: 'DIRECTOR', department: 'COMMERCIAL', jf: 'Business Development / Partnerships', company: 'Healthcare Innovation Alliance', country: 'United States', city: 'Washington', region: 'us', engagement_score: 55, is_verified: false, tags: ['health-it', 'membership'] },
    // World Health Innovation Summit (WHIS) (adding 1 more)
    { first_name: 'Fatma', last_name: 'Al-Zahra', email: 'f.alzahra@whis.ae', job_title: 'Head of Conference Production', seniority_level: 'MANAGER', department: 'OPERATIONS', jf: 'Operations', company: 'World Health Innovation Summit (WHIS)', country: 'UAE', city: 'Dubai', region: 'uae', engagement_score: 48, is_verified: false, tags: ['events', 'uae'] },
    // BioStrategy Partners (adding 1 more)
    { first_name: 'Leopold', last_name: 'Strauss', email: 'l.strauss@biostrategy.ch', job_title: 'Senior Advisor, Licensing', seniority_level: 'MANAGER', department: 'STRATEGY', jf: 'Business Development / Partnerships', company: 'BioStrategy Partners', country: 'Switzerland', city: 'Zurich', region: 'switzerland', engagement_score: 50, is_verified: false, tags: ['licensing', 'pharma-strategy'] },
    // PrecisionPath Consulting (adding 1 more)
    { first_name: 'Danielle', last_name: 'Knight', email: 'd.knight@precisionpath.health', job_title: 'Associate Director', seniority_level: 'MANAGER', department: 'STRATEGY', jf: 'Strategy / Corporate Development', company: 'PrecisionPath Consulting', country: 'United States', city: 'San Francisco', region: 'us', engagement_score: 44, is_verified: false, tags: ['precision-medicine', 'consulting'] },
    // Global Health Economics Ltd (adding 1 more)
    { first_name: 'Rhiannon', last_name: 'Evans', email: 'r.evans@gheconomics.co.uk', job_title: 'Senior Health Economist', seniority_level: 'INDIVIDUAL_CONTRIBUTOR', department: 'STRATEGY', jf: 'Research & Development', company: 'Global Health Economics Ltd', country: 'United Kingdom', city: 'Manchester', region: 'uk', engagement_score: 42, is_verified: false, tags: ['heor', 'hta'] },
    // PinPoint Bioventures (adding 1 more)
    { first_name: 'Zachary', last_name: 'Goldstein', email: 'z.goldstein@pinpointbio.vc', job_title: 'Venture Partner', seniority_level: 'MANAGER', department: 'FINANCE', jf: 'Investor Relations', company: 'PinPoint Bioventures', country: 'United States', city: 'Boston', region: 'us', engagement_score: 65, is_verified: true, tags: ['venture', 'early-stage-biotech'] },
    // Vantage Health Growth Partners (adding 1 more)
    { first_name: 'Heather', last_name: 'Whitmore', email: 'h.whitmore@vantagehgp.com', job_title: 'Senior Associate', seniority_level: 'INDIVIDUAL_CONTRIBUTOR', department: 'FINANCE', jf: 'Investor Relations', company: 'Vantage Health Growth Partners', country: 'United States', city: 'New York', region: 'us', engagement_score: 40, is_verified: false, tags: [] },
    // Horizon MedTech Fund (adding 1 more)
    { first_name: 'Johann', last_name: 'Baumann', email: 'j.baumann@horizonmedtech.de', job_title: 'Senior Associate', seniority_level: 'INDIVIDUAL_CONTRIBUTOR', department: 'FINANCE', jf: 'Investor Relations', company: 'Horizon MedTech Fund', country: 'Germany', city: 'Berlin', region: 'germany', engagement_score: 37, is_verified: false, tags: [] },
    // CardioSense Devices (adding 1 more)
    { first_name: 'Nicole', last_name: 'Laurent', email: 'n.laurent@cardiosense.io', job_title: 'Head of Regulatory Affairs', seniority_level: 'DIRECTOR', department: 'REGULATORY', jf: 'Regulatory Affairs', company: 'CardioSense Devices', country: 'United States', city: 'Minneapolis', region: 'us', engagement_score: 48, is_verified: false, tags: ['cardiac', 'fda-regulatory'] },
    // Axiom Biosciences (adding 1 more)
    { first_name: 'Isabela', last_name: 'Nascimento', email: 'i.nascimento@axiombio.com', job_title: 'Head of Biology', seniority_level: 'DIRECTOR', department: 'RD', jf: 'Research & Development', company: 'Axiom Biosciences', country: 'United States', city: 'Boston', region: 'us', engagement_score: 52, is_verified: false, tags: ['generative-ai', 'drug-discovery'] },

    // Final 5 contacts to reach 200
    { first_name: 'Sanjay', last_name: 'Rajan', email: 's.rajan@praxiscro.com', job_title: 'Director, Global Safety', seniority_level: 'DIRECTOR', department: 'REGULATORY', jf: 'Regulatory Affairs', company: 'Praxis Clinical Research', country: 'United States', city: 'Raleigh', region: 'us', engagement_score: 46, is_verified: false, tags: ['pharmacovigilance'] },
    { first_name: 'Tina', last_name: 'Rosberg', email: 't.rosberg@medai.systems', job_title: 'Head of Clinical Validation', seniority_level: 'DIRECTOR', department: 'CLINICAL', jf: 'Clinical / Medical Affairs', company: 'MedAI Systems', country: 'United Kingdom', city: 'London', region: 'uk', engagement_score: 61, is_verified: true, tags: ['validation', 'radiology'] },
    { first_name: 'Omar', last_name: 'Al-Jabri', email: 'o.aljabri@whis.ae', job_title: 'Regional Director, MENA', seniority_level: 'DIRECTOR', department: 'COMMERCIAL', jf: 'Business Development / Partnerships', company: 'World Health Innovation Summit (WHIS)', country: 'UAE', city: 'Abu Dhabi', region: 'uae', engagement_score: 58, is_verified: false, tags: ['mena', 'healthcare-events'] },
    { first_name: 'Elaine', last_name: 'Fong', email: 'e.fong@connectcare.com.au', job_title: 'Head of Clinical Governance', seniority_level: 'DIRECTOR', department: 'CLINICAL', jf: 'Clinical / Medical Affairs', company: 'ConnectCare Platforms', country: 'Australia', city: 'Melbourne', region: 'australia', engagement_score: 51, is_verified: false, tags: ['aged-care', 'clinical-governance'] },
    { first_name: 'Antoine', last_name: 'Moreau', email: 'a.moreau@sovereignhc.com', job_title: 'VP Healthcare Services', seniority_level: 'VP', department: 'STRATEGY', jf: 'Strategy / Corporate Development', company: 'Sovereign Healthcare Capital', country: 'France', city: 'Paris', region: 'france', engagement_score: 63, is_verified: true, tags: ['pe', 'healthcare-services', 'europe'] },
  ]

  let contactCount = 0
  for (const c of contacts) {
    const jfSlug = c.jf.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    let jobFunctionId: string | undefined
    // Find closest matching job function
    for (const [slug, id] of Object.entries(jfMap)) {
      if (slug === jfSlug || c.jf === slug) { jobFunctionId = id; break }
      const parts = jfSlug.split('-')
      if (parts.some(p => slug.includes(p) && p.length > 4)) { jobFunctionId = id }
    }
    const regionId = regionMap[c.region]
    const companyId = cid(c.company)
    if (!companyId) { console.warn(`Company not found: ${c.company}`); continue }
    await prisma.contact.upsert({
      where: { email: c.email },
      update: {},
      create: {
        first_name: c.first_name,
        last_name: c.last_name,
        email: c.email,
        job_title: c.job_title,
        seniority_level: c.seniority_level as any,
        department: c.department as any,
        job_function_id: jobFunctionId,
        company_id: companyId,
        country: c.country,
        city: c.city,
        region_id: regionId,
        engagement_score: c.engagement_score,
        is_verified: c.is_verified,
        tags: c.tags,
        source: 'seed',
        last_verified_at: c.is_verified ? new Date() : undefined,
      } as any,
    })
    contactCount++
  }
  console.log(`  → Created ${contactCount} contacts`)


  // ─── DEALS ────────────────────────────────────────────────────────────────
  console.log('→ Seeding deals...')

  const dealData = [
    {
      title: 'NovaMedica Therapeutics Acquires OncoBridge Sciences',
      deal_type: 'MA_ACQUISITION', deal_stage: 'COMPLETED',
      deal_value_usd: BigInt(2_400_000_000_00), deal_value_disclosed: true,
      announced_date: new Date('2024-03-15'), closed_date: new Date('2024-07-02'),
      acquirer: 'NovaMedica Therapeutics', target: 'OncoBridge Sciences',
      description: 'NovaMedica acquires OncoBridge to strengthen its ADC pipeline, adding three Phase II oncology candidates.',
      region: 'North America', country: 'United States',
      verticals: ['large-pharma', 'biotech-clinical'], source: 'seed',
    },
    {
      title: 'Sovereign Healthcare Capital Acquires CareFirst Ambulatory Group',
      deal_type: 'PE_BUYOUT', deal_stage: 'COMPLETED',
      deal_value_usd: BigInt(890_000_000_00), deal_value_disclosed: true,
      announced_date: new Date('2023-11-08'), closed_date: new Date('2024-02-28'),
      acquirer: 'Sovereign Healthcare Capital', target: 'CareFirst Ambulatory Group',
      description: 'Sovereign acquires CareFirst in a £700M buyout to create a leading UK and US ambulatory care platform.',
      region: 'North America', country: 'United States',
      verticals: ['healthcare-pe-vc', 'ambulatory'], source: 'seed',
    },
    {
      title: 'Quantis Health Intelligence Series B Funding Round',
      deal_type: 'VC_SERIES_B', deal_stage: 'COMPLETED',
      deal_value_usd: BigInt(65_000_000_00), deal_value_disclosed: true,
      announced_date: new Date('2024-02-20'),
      target: 'Quantis Health Intelligence',
      description: 'NLP and generative AI startup raises $65M Series B to accelerate commercial rollout across US health systems.',
      region: 'North America', country: 'United States',
      verticals: ['nlp-clinical', 'generative-ai'], source: 'seed',
      investors: [
        { company: 'Apogee Health Ventures', role: 'LEAD', amount: BigInt(30_000_000_00) },
        { company: 'Vantage Health Growth Partners', role: 'CO_LEAD', amount: BigInt(20_000_000_00) },
      ],
    },
    {
      title: 'Axiom Biosciences Series C — AI Drug Discovery',
      deal_type: 'VC_SERIES_C_PLUS', deal_stage: 'COMPLETED',
      deal_value_usd: BigInt(120_000_000_00), deal_value_disclosed: true,
      announced_date: new Date('2024-06-10'),
      target: 'Axiom Biosciences',
      description: 'Boston-based AI drug discovery biotech raises $120M Series C to advance its AI-generated oncology compounds.',
      region: 'North America', country: 'United States',
      verticals: ['drug-discovery-ai', 'biotech-preclinical'], source: 'seed',
      investors: [
        { company: 'PinPoint Bioventures', role: 'LEAD', amount: BigInt(50_000_000_00) },
        { company: 'Apogee Health Ventures', role: 'PARTICIPANT', amount: BigInt(35_000_000_00) },
      ],
    },
    {
      title: 'Luminex Health Technologies Acquires HealthFlow Analytics',
      deal_type: 'MA_ACQUISITION', deal_stage: 'ANNOUNCED',
      deal_value_usd: BigInt(320_000_000_00), deal_value_disclosed: true,
      announced_date: new Date('2025-01-14'),
      acquirer: 'Luminex Health Technologies', target: 'HealthFlow Analytics',
      description: 'Luminex acquires HealthFlow to expand its population health and predictive analytics capabilities in the MA payer market.',
      region: 'North America', country: 'United States',
      verticals: ['population-health', 'predictive-analytics'], source: 'seed',
    },
    {
      title: 'MedAI Systems NHS Strategic Partnership',
      deal_type: 'LICENSING_PARTNERSHIP', deal_stage: 'COMPLETED',
      deal_value_usd: null, deal_value_disclosed: false,
      announced_date: new Date('2023-09-05'),
      acquirer: 'NHS Greater London Trust', target: 'MedAI Systems',
      description: 'Multi-year partnership to deploy MedAI radiology AI across 8 London NHS Trusts, covering 2M chest X-rays annually.',
      region: 'Europe', country: 'United Kingdom',
      verticals: ['medical-imaging-ai', 'hospitals'], source: 'seed',
    },
    {
      title: 'BioManufact Partners — Cell & Gene Therapy CDMO Expansion',
      deal_type: 'PE_GROWTH_EQUITY', deal_stage: 'COMPLETED',
      deal_value_usd: BigInt(180_000_000_00), deal_value_disclosed: true,
      announced_date: new Date('2024-04-22'),
      target: 'BioManufact Partners',
      description: 'Sovereign Healthcare Capital invests $180M growth equity into BioManufact to expand cell & gene therapy manufacturing capacity.',
      region: 'Europe', country: 'Switzerland',
      verticals: ['cdmo', 'healthcare-pe-vc'], source: 'seed',
      investors: [
        { company: 'Sovereign Healthcare Capital', role: 'LEAD', amount: BigInt(180_000_000_00) },
      ],
    },
    {
      title: 'Vericel Genomics Seed Round',
      deal_type: 'VC_SEED', deal_stage: 'COMPLETED',
      deal_value_usd: BigInt(12_000_000_00), deal_value_disclosed: true,
      announced_date: new Date('2023-05-18'),
      target: 'Vericel Genomics',
      description: 'CRISPR rare disease startup raises $12M seed round to fund IND-enabling studies for its lead programme.',
      region: 'North America', country: 'United States',
      verticals: ['genomics', 'biotech-preclinical'], source: 'seed',
      investors: [
        { company: 'PinPoint Bioventures', role: 'LEAD', amount: BigInt(8_000_000_00) },
      ],
    },
    {
      title: 'CytaPath Therapeutics IPO on NASDAQ',
      deal_type: 'IPO', deal_stage: 'COMPLETED',
      deal_value_usd: BigInt(230_000_000_00), deal_value_disclosed: true,
      announced_date: new Date('2023-10-02'), closed_date: new Date('2023-10-02'),
      target: 'CytaPath Therapeutics',
      description: 'Clinical-stage CAR-T biotech raises $230M in its NASDAQ IPO, becoming one of the largest biotech listings of Q4 2023.',
      region: 'North America', country: 'United States',
      verticals: ['biotech-clinical'], source: 'seed',
    },
    {
      title: 'NovaMedica & Praxis Clinical Research Global Trial Partnership',
      deal_type: 'LICENSING_PARTNERSHIP', deal_stage: 'COMPLETED',
      deal_value_usd: BigInt(45_000_000_00), deal_value_disclosed: true,
      announced_date: new Date('2024-01-30'),
      acquirer: 'NovaMedica Therapeutics', target: 'Praxis Clinical Research',
      description: 'Multi-year CRO partnership for Phase III oncology trials across US, Europe, and Asia-Pacific.',
      region: 'North America', country: 'United States',
      verticals: ['cro', 'clinical-trials', 'large-pharma'], source: 'seed',
    },
    {
      title: 'Helix Pharma Acquires Pangolin Pharma',
      deal_type: 'MA_ACQUISITION', deal_stage: 'ANNOUNCED',
      deal_value_usd: BigInt(750_000_000_00), deal_value_disclosed: true,
      announced_date: new Date('2025-02-10'),
      acquirer: 'Helix Pharma Group', target: 'Pangolin Pharma',
      description: 'Helix acquires Swiss specialty pharma Pangolin to strengthen its respiratory and metabolic disease portfolios.',
      region: 'Europe', country: 'United Kingdom',
      verticals: ['specialty-pharma', 'large-pharma'], source: 'seed',
    },
    {
      title: 'Synapse Clinical AI Series A',
      deal_type: 'VC_SERIES_A', deal_stage: 'COMPLETED',
      deal_value_usd: BigInt(28_000_000_00), deal_value_disclosed: true,
      announced_date: new Date('2024-05-07'),
      target: 'Synapse Clinical AI',
      description: 'Singapore-based agentic AI startup raises $28M Series A from Apogee and regional investors to expand across Asia-Pacific.',
      region: 'Asia-Pacific', country: 'Singapore',
      verticals: ['agentic-ai', 'clinical-ai'], source: 'seed',
      investors: [
        { company: 'Apogee Health Ventures', role: 'LEAD', amount: BigInt(15_000_000_00) },
      ],
    },
    {
      title: 'Kinetic Surgical Technologies Acquires CardioSense Devices',
      deal_type: 'MA_ACQUISITION', deal_stage: 'ANNOUNCED',
      deal_value_usd: BigInt(420_000_000_00), deal_value_disclosed: true,
      announced_date: new Date('2025-03-01'),
      acquirer: 'Kinetic Surgical Technologies', target: 'CardioSense Devices',
      description: 'Kinetic expands into cardiac monitoring by acquiring CardioSense, adding an implantable remote monitoring product line.',
      region: 'North America', country: 'United States',
      verticals: ['surgical-robotics', 'implantables', 'wearables'], source: 'seed',
    },
    {
      title: 'DiagnoPath IVD Receives NIHR Grant for Liquid Biopsy Research',
      deal_type: 'GRANT', deal_stage: 'COMPLETED',
      deal_value_usd: BigInt(8_500_000_00), deal_value_disclosed: true,
      announced_date: new Date('2024-07-15'),
      target: 'DiagnoPath IVD',
      description: 'NIHR awards €8.5M grant to DiagnoPath for multi-centre clinical validation of its ctDNA liquid biopsy test in early-stage lung cancer.',
      region: 'Europe', country: 'Germany',
      verticals: ['ivd', 'clinical-trials'], source: 'seed',
    },
    {
      title: 'TrialSpark Innovations Series B — Decentralised Trials Platform',
      deal_type: 'VC_SERIES_B', deal_stage: 'COMPLETED',
      deal_value_usd: BigInt(52_000_000_00), deal_value_disclosed: true,
      announced_date: new Date('2024-09-18'),
      target: 'TrialSpark Innovations',
      description: 'DCT platform raises $52M Series B to expand its decentralised trial capabilities into Europe and Asia.',
      region: 'North America', country: 'United States',
      verticals: ['cro', 'clinical-trials', 'remote-monitoring'], source: 'seed',
      investors: [
        { company: 'Apogee Health Ventures', role: 'LEAD', amount: BigInt(25_000_000_00) },
        { company: 'Horizon MedTech Fund', role: 'PARTICIPANT', amount: BigInt(15_000_000_00) },
      ],
    },
    {
      title: 'Meridian Health Network NHS Greater London Digital Collaboration',
      deal_type: 'JOINT_VENTURE', deal_stage: 'ANNOUNCED',
      deal_value_usd: null, deal_value_disclosed: false,
      announced_date: new Date('2025-01-20'),
      acquirer: 'Meridian Health Network', target: 'NHS Greater London Trust',
      description: 'US health system and NHS Trust announce joint AI clinical research and digital health exchange programme.',
      region: 'Europe', country: 'United Kingdom',
      verticals: ['hospitals', 'clinical-ai'], source: 'seed',
    },
    {
      title: 'MindWell Behavioural Health Series A',
      deal_type: 'VC_SERIES_A', deal_stage: 'COMPLETED',
      deal_value_usd: BigInt(35_000_000_00), deal_value_disclosed: true,
      announced_date: new Date('2023-12-05'),
      target: 'MindWell Behavioural Health',
      description: 'Tech-enabled mental health network raises $35M Series A to scale employer mental health programmes nationally.',
      region: 'North America', country: 'United States',
      verticals: ['behavioural-health', 'telemedicine'], source: 'seed',
      investors: [
        { company: 'Vantage Health Growth Partners', role: 'LEAD', amount: BigInt(20_000_000_00) },
      ],
    },
    {
      title: 'Helix Pharma CNS Licensing Deal with Meridian Biopharma',
      deal_type: 'LICENSING_PARTNERSHIP', deal_stage: 'COMPLETED',
      deal_value_usd: BigInt(155_000_000_00), deal_value_disclosed: true,
      announced_date: new Date('2023-08-14'),
      acquirer: 'Helix Pharma Group', target: 'Meridian Biopharma',
      description: 'Helix licenses Meridian\'s CNS compound for European commercialisation, with $155M in upfront and milestone payments.',
      region: 'Europe', country: 'United Kingdom',
      verticals: ['specialty-pharma', 'large-pharma'], source: 'seed',
    },
    {
      title: 'Praxis Clinical Research Acquires RealEvidence Analytics',
      deal_type: 'MA_ACQUISITION', deal_stage: 'COMPLETED',
      deal_value_usd: BigInt(210_000_000_00), deal_value_disclosed: true,
      announced_date: new Date('2024-10-07'), closed_date: new Date('2025-01-03'),
      acquirer: 'Praxis Clinical Research', target: 'RealEvidence Analytics',
      description: 'Praxis acquires UK-based RWE consultancy to build an integrated trial and real-world evidence platform.',
      region: 'Europe', country: 'United Kingdom',
      verticals: ['cro', 'rwe'], source: 'seed',
    },
    {
      title: 'ConnectCare Platforms Series B — Asia-Pacific Expansion',
      deal_type: 'VC_SERIES_B', deal_stage: 'COMPLETED',
      deal_value_usd: BigInt(40_000_000_00), deal_value_disclosed: true,
      announced_date: new Date('2024-08-22'),
      target: 'ConnectCare Platforms',
      description: 'Australian patient engagement platform raises $40M to expand into Japan and Southeast Asia.',
      region: 'Asia-Pacific', country: 'Australia',
      verticals: ['telemedicine', 'home-health'], source: 'seed',
      investors: [
        { company: 'Apogee Health Ventures', role: 'PARTICIPANT', amount: BigInt(12_000_000_00) },
      ],
    },
    {
      title: 'SynthoGene Therapeutics Pre-Seed Round',
      deal_type: 'VC_SEED', deal_stage: 'COMPLETED',
      deal_value_usd: BigInt(5_000_000_00), deal_value_disclosed: true,
      announced_date: new Date('2023-03-30'),
      target: 'SynthoGene Therapeutics',
      description: 'Stealth RNA therapeutics startup raises $5M pre-seed from Israeli and US investors.',
      region: 'Middle East & Africa', country: 'Israel',
      verticals: ['biotech-preclinical'], source: 'seed',
      investors: [
        { company: 'PinPoint Bioventures', role: 'PARTICIPANT', amount: BigInt(2_000_000_00) },
      ],
    },
    {
      title: 'PatientPath Technologies Private Equity Buyout',
      deal_type: 'PE_BUYOUT', deal_stage: 'COMPLETED',
      deal_value_usd: BigInt(175_000_000_00), deal_value_disclosed: true,
      announced_date: new Date('2023-07-19'), closed_date: new Date('2023-10-31'),
      target: 'PatientPath Technologies',
      description: 'Sovereign Healthcare Capital acquires PatientPath in a platform buyout to consolidate the revenue cycle management market.',
      region: 'North America', country: 'United States',
      verticals: ['revenue-cycle', 'healthcare-pe-vc'], source: 'seed',
      investors: [
        { company: 'Sovereign Healthcare Capital', role: 'LEAD', amount: BigInt(175_000_000_00) },
      ],
    },
    {
      title: 'NexGen Health Exchange Government Expansion Grant',
      deal_type: 'GRANT', deal_stage: 'COMPLETED',
      deal_value_usd: BigInt(22_000_000_00), deal_value_disclosed: true,
      announced_date: new Date('2024-03-01'),
      target: 'NexGen Health Exchange',
      description: 'HHS awards $22M to NexGen to extend HIE infrastructure to rural and underserved communities across 5 new states.',
      region: 'North America', country: 'United States',
      verticals: ['hie', 'government-public-health'], source: 'seed',
    },
    {
      title: 'Apogee Health Ventures Fund III Close',
      deal_type: 'SECONDARY_SALE', deal_stage: 'COMPLETED',
      deal_value_usd: BigInt(750_000_000_00), deal_value_disclosed: true,
      announced_date: new Date('2023-11-30'),
      acquirer: 'Apogee Health Ventures',
      description: 'Apogee closes its third healthcare venture fund at $750M, focused on digital health, AI, and biotech.',
      region: 'North America', country: 'United States',
      verticals: ['healthcare-pe-vc'], source: 'seed',
    },
    {
      title: 'Meridian Biopharma IPO on Euronext',
      deal_type: 'IPO', deal_stage: 'COMPLETED',
      deal_value_usd: BigInt(340_000_000_00), deal_value_disclosed: true,
      announced_date: new Date('2023-06-01'),
      target: 'Meridian Biopharma',
      description: 'Dutch pharma company raises €340M in Euronext Amsterdam IPO, becoming one of Europe\'s largest pharma listings in 2023.',
      region: 'Europe', country: 'Netherlands',
      verticals: ['large-pharma'], source: 'seed',
    },
    {
      title: 'BioSignal Wearables Licensing Deal with Meridian Health Network',
      deal_type: 'LICENSING_PARTNERSHIP', deal_stage: 'COMPLETED',
      deal_value_usd: null, deal_value_disclosed: false,
      announced_date: new Date('2024-11-12'),
      acquirer: 'Meridian Health Network', target: 'BioSignal Wearables',
      description: 'Multi-year cardiac monitoring deployment partnership for BioSignal devices across Meridian\'s 12 hospitals.',
      region: 'North America', country: 'United States',
      verticals: ['wearables', 'remote-monitoring', 'hospitals'], source: 'seed',
    },
    {
      title: 'PathBio Manufacturing Debt Financing for Expansion',
      deal_type: 'DEBT_FINANCING', deal_stage: 'COMPLETED',
      deal_value_usd: BigInt(50_000_000_00), deal_value_disclosed: true,
      announced_date: new Date('2024-05-30'),
      target: 'PathBio Manufacturing',
      description: '$50M term loan from Citibank to fund new solid-dose manufacturing facility in Hyderabad.',
      region: 'Asia-Pacific', country: 'India',
      verticals: ['cdmo'], source: 'seed',
    },
    {
      title: 'MedSynth Biologics PE Recapitalisation',
      deal_type: 'PE_RECAPITALISATION', deal_stage: 'COMPLETED',
      deal_value_usd: BigInt(280_000_000_00), deal_value_disclosed: true,
      announced_date: new Date('2023-09-25'),
      target: 'MedSynth Biologics',
      description: 'Sovereign Healthcare Capital recapitalises MedSynth at a $1.2B valuation, bringing in new co-investors for European expansion.',
      region: 'Europe', country: 'Germany',
      verticals: ['generic-biosimilars', 'healthcare-pe-vc'], source: 'seed',
      investors: [
        { company: 'Sovereign Healthcare Capital', role: 'LEAD', amount: BigInt(200_000_000_00) },
      ],
    },
    {
      title: 'NHS England Digital — AI Framework Programme',
      deal_type: 'LICENSING_PARTNERSHIP', deal_stage: 'ANNOUNCED',
      deal_value_usd: null, deal_value_disclosed: false,
      announced_date: new Date('2025-02-28'),
      acquirer: 'NHS England Digital', target: 'Luminex Health Technologies',
      description: 'NHS England Digital selects Luminex as a preferred AI analytics partner under the national AI framework.',
      region: 'Europe', country: 'United Kingdom',
      verticals: ['government-public-health', 'clinical-ai', 'population-health'], source: 'seed',
    },
    {
      title: 'OncoBridge Sciences Series C — Pre-Acquisition Bridge',
      deal_type: 'VC_SERIES_C_PLUS', deal_stage: 'COMPLETED',
      deal_value_usd: BigInt(85_000_000_00), deal_value_disclosed: true,
      announced_date: new Date('2023-07-12'),
      target: 'OncoBridge Sciences',
      description: 'OncoBridge raises $85M Series C (subsequently acquired by NovaMedica) to advance its lead ADC into Phase III.',
      region: 'North America', country: 'United States',
      verticals: ['biotech-clinical'], source: 'seed',
      investors: [
        { company: 'PinPoint Bioventures', role: 'LEAD', amount: BigInt(40_000_000_00) },
        { company: 'Apogee Health Ventures', role: 'CO_LEAD', amount: BigInt(30_000_000_00) },
      ],
    },
  ]

  let dealCount = 0
  for (const d of dealData) {
    const { verticals: dverts, investors: dinvestors, acquirer, target, source: dealSource, ...dealFields } = d as any
    const acquirerId = acquirer ? cid(acquirer) : null
    const targetId = target ? cid(target) : null
    const dealId = `seed-deal-${dealCount}`
    await prisma.deal.upsert({
      where: { id: dealId },
      update: {},
      create: {
        id: dealId,
        ...dealFields,
        acquirer_company_id: acquirerId,
        target_company_id: targetId,
        source: dealSource,
        tags: [],
      },
    })
    // Verticals
    for (const v of (dverts ?? [])) {
      const vid = verticalMap[v]
      if (vid) await prisma.dealVertical.upsert({
        where: { deal_id_vertical_id: { deal_id: dealId, vertical_id: vid } },
        update: {},
        create: { deal_id: dealId, vertical_id: vid },
      })
    }
    // Investors
    for (const inv of (dinvestors ?? [])) {
      const invId = cid(inv.company)
      if (invId) await prisma.dealInvestor.upsert({
        where: { deal_id_company_id: { deal_id: dealId, company_id: invId } },
        update: {},
        create: { deal_id: dealId, company_id: invId, investor_role: inv.role, investment_amount_usd: inv.amount ?? null },
      })
    }
    dealCount++
  }
  console.log(`  → Created ${dealCount} deals`)


  // ─── INSIGHTS ────────────────────────────────────────────────────────────
  console.log('→ Seeding insights...')

  const insightData: Array<{
    title: string; slug: string; content_type: ContentType; summary: string;
    body: string; author: string; published_at: Date; is_premium: boolean;
    view_count: number; tags: string[]; verticals: string[]; tas: string[];
  }> = [
    {
      title: 'The State of Healthcare AI Investment: Q1 2025 Report',
      slug: 'healthcare-ai-investment-q1-2025',
      content_type: 'QUARTERLY_REPORT',
      summary: 'Global healthcare AI funding reached $8.2B in Q1 2025, with diagnostic AI and agentic AI capturing the majority of deal flow. This report analyses investment trends, key deals, and emerging focus areas.',
      body: `## Executive Summary\n\nHealthcare AI investment surged to $8.2B globally in Q1 2025, representing a 34% year-on-year increase. The quarter was characterised by large late-stage rounds in diagnostic AI, with several companies achieving unicorn valuations.\n\n## Key Findings\n\nDiagnostic AI continues to dominate investment, accounting for 38% of total deal value. Radiology AI, pathology AI, and clinical decision support tools attracted the largest cheques.\n\nAgentic AI in healthcare is emerging as the fastest-growing sub-category, with deal count up 180% year-on-year. Clinical documentation, care coordination, and prior authorisation automation are the primary use cases attracting capital.\n\n## Regional Breakdown\n\nNorth America accounted for 62% of global healthcare AI investment, followed by Europe (21%) and Asia-Pacific (14%). The UK, Germany, and Israel were the leading European markets.\n\n## Outlook\n\nWe expect healthcare AI investment to remain robust through 2025, with particular growth in agentic AI, multimodal clinical AI, and AI-enabled drug discovery.`,
      author: 'WHAI Research Team',
      published_at: new Date('2025-04-10'),
      is_premium: true,
      view_count: 1243,
      tags: ['ai-investment', 'quarterly-report', 'healthcare-ai'],
      verticals: ['ai-ml-healthcare', 'healthcare-pe-vc'],
      tas: ['Oncology'],
    },
    {
      title: 'Digital Health M&A: Why Acquirers Are Targeting Population Health Platforms',
      slug: 'digital-health-ma-population-health-2025',
      content_type: 'ANALYSIS',
      summary: 'Population health management platforms are commanding premium valuations in today\'s M&A market. We analyse five recent acquisitions and identify the common drivers.',
      body: `## The Population Health Premium\n\nAcquirers paid an average 8.3x revenue multiple for population health platform acquisitions in 2024-2025, compared to 5.1x for other health IT assets. What\'s driving this premium?\n\n## Value-Based Care Tailwinds\n\nAs payers and health systems accelerate their transition to value-based care contracts, the demand for population health analytics and care management tools has surged. Acquirers see these platforms as essential infrastructure.\n\n## Data Network Effects\n\nPopulation health platforms improve with scale. The more lives under management, the better the predictive models. This creates strong network effects and defensible moats.\n\n## Recent Notable Transactions\n\nThe Luminex-HealthFlow acquisition is the latest in a series of consolidation moves. Similar to the CVS-Signify, Amazon-One Medical, and UnitedHealth-Change deals, it reflects the strategic imperative to own the population health layer.`,
      author: 'Dr. Emily Watts, WHAI Analytics',
      published_at: new Date('2025-03-15'),
      is_premium: true,
      view_count: 876,
      tags: ['ma', 'population-health', 'digital-health'],
      verticals: ['population-health', 'digital-health', 'healthcare-pe-vc'],
      tas: ['Cardiovascular', 'Metabolic / Diabetes / Obesity'],
    },
    {
      title: 'NHS AI Adoption: Progress, Barriers, and the Path to Scale',
      slug: 'nhs-ai-adoption-2025',
      content_type: 'MARKET_REPORT',
      summary: 'The NHS has approved over 150 AI medical devices, but adoption remains uneven. This report examines where AI is delivering measurable impact and what\'s holding back wider deployment.',
      body: `## The NHS AI Landscape in 2025\n\nAs of early 2025, NHS England has approved over 150 AI-enabled medical devices through its Digital Technology Assessment Criteria (DTAC) framework. However, actual deployment is concentrated in a handful of high-value use cases.\n\n## Where AI Is Working\n\nRadiology AI is the clear frontrunner, with chest X-ray and CT triage tools now deployed across 40% of NHS Trusts. The evidence base is strong and the ROI case is proven.\n\nPathology AI is emerging as the next wave, with digital pathology adoption accelerating following NHSX investment in scanning infrastructure.\n\n## Key Barriers\n\nInteroperability remains the primary challenge. Most NHS Trusts run fragmented IT estates, making it difficult to integrate AI tools into clinical workflows. The national FHIR mandate is expected to ease this significantly by 2026.\n\n## Vendor Landscape\n\nMedAI Systems leads in radiology, while newer entrants including Synapse Clinical AI are gaining ground in clinical documentation and agentic workflows.`,
      author: 'Tom Fielding, WHAI UK Correspondent',
      published_at: new Date('2025-02-28'),
      is_premium: false,
      view_count: 2104,
      tags: ['nhs', 'ai-adoption', 'uk-health'],
      verticals: ['medical-imaging-ai', 'agentic-ai', 'government-public-health'],
      tas: [],
    },
    {
      title: 'CAR-T Cell Therapy: The Commercial Landscape in 2025',
      slug: 'car-t-commercial-landscape-2025',
      content_type: 'MARKET_REPORT',
      summary: 'CAR-T therapy has moved from experimental to established standard of care in haematological malignancies. This report tracks the competitive landscape, pricing dynamics, and manufacturing challenges.',
      body: `## CAR-T Goes Mainstream\n\nWith multiple approved products and growing clinical evidence, CAR-T cell therapy is now a standard of care option for relapsed/refractory B-cell malignancies. But commercial success has been uneven.\n\n## The Pipeline\n\nBeyond the approved products, there are over 400 CAR-T programmes in development globally. The focus is shifting to solid tumours, allogeneic (off-the-shelf) approaches, and next-generation constructs with improved safety profiles.\n\n## Manufacturing: Still the Achilles Heel\n\nAutologous CAR-T manufacturing remains complex, costly, and slow. Average vein-to-vein time of 3-4 weeks limits patient access. BioManufact Partners and similar CDMOs are investing heavily in process improvements.\n\n## The CytaPath Story\n\nCytaPath\'s recent IPO and pipeline progress represent a significant validation for the next generation of CAR-T. Their approach to reducing manufacturing complexity is being watched closely.`,
      author: 'Dr. Priya Rajan, WHAI Research',
      published_at: new Date('2025-01-20'),
      is_premium: true,
      view_count: 654,
      tags: ['car-t', 'cell-therapy', 'oncology'],
      verticals: ['biotech-clinical', 'genomics'],
      tas: ['Haematology', 'Oncology', 'Gene Therapy / Cell Therapy'],
    },
    {
      title: 'Telehealth in 2025: Post-Pandemic Normalisation and What Comes Next',
      slug: 'telehealth-2025-normalisation',
      content_type: 'ANALYSIS',
      summary: 'After the pandemic-era boom and subsequent correction, telehealth has found its steady-state growth trajectory. We assess adoption rates, payer reimbursement, and the hybrid care model.',
      body: `## The Great Normalisation\n\nTelehealth utilisation peaked in mid-2020 and has since settled at approximately 10-15x pre-pandemic levels. This "normalisation" is actually a significant and durable expansion of virtual care.\n\n## Where Telehealth Sticks\n\nMental health and behavioural health have seen the most durable virtual care adoption. Nearly 70% of mental health consultations are now delivered virtually in the US. Dermatology, primary care follow-up, and chronic disease management are also strong.\n\n## Payer Reimbursement: The Permanent Shift\n\nCMS has made most pandemic-era telehealth flexibilities permanent or extended, significantly reducing regulatory uncertainty. Commercial payers have largely followed.\n\n## The Hybrid Care Model\n\nLeading platforms like CareStream Digital Health are evolving from pure telehealth to hybrid care models that combine virtual and in-person touchpoints with continuous remote monitoring.`,
      author: 'Sarah Chen, WHAI Research',
      published_at: new Date('2025-01-05'),
      is_premium: false,
      view_count: 1567,
      tags: ['telehealth', 'virtual-care', 'reimbursement'],
      verticals: ['telemedicine', 'remote-monitoring'],
      tas: ['Mental Health / Psychiatry', 'Cardiovascular'],
    },
    {
      title: 'Generative AI in Drug Discovery: Hype vs. Reality',
      slug: 'generative-ai-drug-discovery-2025',
      content_type: 'ANALYSIS',
      summary: 'Dozens of companies claim to use generative AI to revolutionise drug discovery. WHAI examines the evidence: where is AI genuinely accelerating pipelines, and where is it still aspirational?',
      body: `## The Claims\n\nAt least 40 companies have raised over $100M claiming to use generative AI to dramatically compress drug discovery timelines. But as the first AI-designed molecules enter clinical trials, the evidence is beginning to emerge.\n\n## What\'s Working: Target Identification\n\nAI models are demonstrably improving the identification of novel drug targets, particularly in complex diseases where traditional biology has struggled. This is where the current evidence base is strongest.\n\n## What\'s Harder: Hit-to-Lead\n\nGenerating novel molecules with desired properties is harder than early claims suggested. Synthesis success rates and in vitro activity don\'t always match in silico predictions.\n\n## Axiom\'s Approach\n\nAxiom Biosciences represents an interesting case study — their platform combines generative chemistry with proprietary biological assay data. Their Series C funding suggests investors remain believers, but clinical proof points will be critical over the next 24 months.`,
      author: 'James Harrington, WHAI Senior Analyst',
      published_at: new Date('2024-12-10'),
      is_premium: true,
      view_count: 2345,
      tags: ['generative-ai', 'drug-discovery', 'biotech'],
      verticals: ['drug-discovery-ai', 'generative-ai', 'ai-ml-healthcare'],
      tas: ['Oncology', 'Metabolic / Diabetes / Obesity'],
    },
    {
      title: 'European Healthcare Dealmaking: Q4 2024 Roundup',
      slug: 'european-healthcare-deals-q4-2024',
      content_type: 'NEWS_BRIEF',
      summary: 'Key deals, funding rounds, and M&A activity across European healthcare in Q4 2024, including notable UK, German, and Swiss transactions.',
      body: `## Q4 2024: A Busy End to the Year\n\nEuropean healthcare M&A and fundraising remained active through Q4 2024, with notable activity in pharma, medtech, and digital health.\n\n## Notable Transactions\n\nHelix Pharma announced its £600M acquisition of Swiss specialty pharma Pangolin, one of the largest European pharma deals of the year. The deal is expected to close in Q2 2025.\n\nMedSynth Biologics completed a €280M PE recapitalisation with Sovereign Healthcare Capital, signalling continued PE appetite for biosimilars.\n\nBioManufact Partners raised $180M growth equity to expand its cell & gene therapy CDMO capacity.\n\n## UK Digital Health Activity\n\nMedAI Systems continued to expand its NHS footprint, with new contract announcements in Leeds, Birmingham, and Manchester Trusts. The company is reportedly exploring a Series B fundraise in early 2025.`,
      author: 'WHAI Deals Team',
      published_at: new Date('2024-11-30'),
      is_premium: false,
      view_count: 3201,
      tags: ['european-deals', 'q4-2024', 'pharma-ma'],
      verticals: ['specialty-pharma', 'cdmo', 'medical-imaging-ai'],
      tas: ['Oncology', 'Immunology / Autoimmune'],
    },
    {
      title: 'Value-Based Care: From Pilot to Mainstream?',
      slug: 'value-based-care-mainstream-2025',
      content_type: 'MARKET_REPORT',
      summary: 'Value-based care contracts now cover 60% of US commercial lives. We assess the transition from fee-for-service, the winners and losers, and the technology stack driving the shift.',
      body: `## A Decade in the Making\n\nAfter years of pilot programmes and gradual transition, value-based care is genuinely mainstream. Over 60% of US commercial healthcare expenditure now flows through some form of value-based contract.\n\n## The Technology Stack\n\nThe shift to value-based care has created significant demand for population health analytics, care management tools, and advanced data infrastructure. Luminex Health Technologies, HealthFlow Analytics, and similar companies have benefited enormously.\n\n## Health System Readiness\n\nNot all health systems are equally prepared. Rural and community hospitals are significantly behind large academic medical centres in their data and analytics capabilities.\n\n## Payer Perspective\n\nMedicare Advantage plans with value-based care models are significantly outperforming fee-for-service on clinical quality measures. This is driving further acceleration of the model.`,
      author: 'Rachel Donnelly, WHAI Research',
      published_at: new Date('2024-10-20'),
      is_premium: false,
      view_count: 1876,
      tags: ['value-based-care', 'US-health', 'population-health'],
      verticals: ['value-based-care', 'population-health', 'payer-insurance'],
      tas: ['Cardiovascular', 'Metabolic / Diabetes / Obesity'],
    },
    {
      title: 'Rare Disease Investment: The Surge in Orphan Drug Development',
      slug: 'rare-disease-investment-2025',
      content_type: 'DATA_SNAPSHOT',
      summary: 'Rare disease has become one of pharma\'s most active development areas. WHAI data shows over $12B invested in rare disease biotech in 2024. Here\'s where the money is going.',
      body: `## By the Numbers\n\nRare disease biotech attracted $12.3B in venture investment in 2024, representing 28% of total biopharma VC. This compares to just 15% five years ago.\n\n## Why Rare Disease?\n\nRegulatory advantages (orphan drug designation, priority review, extended exclusivity), the advent of platform technologies (gene therapy, RNA, CRISPR), and demonstrated commercial success have made rare disease commercially attractive.\n\n## Key Therapeutic Categories\n\nGene therapy remains the most active area, particularly for rare neurological and metabolic conditions. RNA therapeutics (ASOs, siRNA, mRNA) are growing rapidly. Small molecules retain a role in many enzyme replacement strategies.\n\n## Vericel Genomics Spotlight\n\nVericel\'s CRISPR-based approach to rare genetic diseases represents the type of precision targeting that is attracting investor interest. Their seed funding is modest, but the scientific approach is highly regarded.`,
      author: 'WHAI Data Team',
      published_at: new Date('2024-09-15'),
      is_premium: true,
      view_count: 892,
      tags: ['rare-disease', 'orphan-drugs', 'gene-therapy', 'data'],
      verticals: ['genomics', 'biotech-preclinical'],
      tas: ['Rare Diseases / Orphan Drugs', 'Gene Therapy / Cell Therapy', 'Neurology / CNS'],
    },
    {
      title: 'Asia-Pacific Digital Health: Markets to Watch in 2025',
      slug: 'apac-digital-health-2025',
      content_type: 'MARKET_REPORT',
      summary: 'Asia-Pacific is emerging as a major force in digital health innovation. Singapore, Japan, and India are leading the way. Here\'s our market-by-market analysis.',
      body: `## The APAC Digital Health Opportunity\n\nAsia-Pacific digital health investment reached $4.2B in 2024, up 45% year-on-year. The region is no longer just an implementation market for Western technologies — it\'s becoming a significant source of innovation.\n\n## Singapore: The Hub\n\nSingHealth and the broader Singapore health ecosystem continue to attract international digital health companies while incubating homegrown innovators. Synapse Clinical AI is a leading example of APAC-native AI development.\n\n## Japan: Catching Up Fast\n\nJapan\'s ageing population and historically conservative health IT market are driving rapid digital transformation. OptiVision\'s AI-powered retinal imaging is gaining significant traction in diabetic screening programmes.\n\n## India: The Back Office and Beyond\n\nIndia\'s digital health market is evolving beyond healthcare IT services to genuine product development. PathBio Manufacturing represents the maturing Indian life sciences services sector.`,
      author: 'Mei Chen, WHAI APAC Correspondent',
      published_at: new Date('2024-08-05'),
      is_premium: false,
      view_count: 1432,
      tags: ['apac', 'digital-health', 'singapore', 'japan'],
      verticals: ['digital-health', 'ai-ml-healthcare'],
      tas: ['Metabolic / Diabetes / Obesity', 'Infectious Disease'],
    },
    {
      title: 'What the Praxis-RealEvidence Deal Means for CRO Consolidation',
      slug: 'praxis-realevidence-cro-consolidation',
      content_type: 'NEWS_BRIEF',
      summary: 'Praxis Clinical Research\'s acquisition of RealEvidence Analytics signals the next wave of CRO consolidation: the integration of real-world evidence capabilities into full-service clinical research.',
      body: `## The Deal\n\nPraxis Clinical Research announced the $210M acquisition of Oxford-based RealEvidence Analytics in October 2024. The deal closed in January 2025 following regulatory clearance.\n\n## Why This Matters\n\nThe acquisition reflects a broader strategic trend among large CROs: the integration of real-world evidence (RWE) and health economics & outcomes research (HEOR) capabilities to offer sponsors a seamless clinical-to-commercial research continuum.\n\n## Competitive Context\n\nCovance, Parexel, and IQVIA have all made similar moves, acquiring or building RWE practices. The Praxis deal accelerates the arms race and puts pressure on mid-sized CROs to differentiate.\n\n## Implications for Sponsors\n\nPharmaceutical companies will increasingly expect their CRO partners to offer integrated clinical trial and real-world evidence design from day one. Sponsors who work with CROs lacking RWE capabilities may face competitive disadvantage in regulatory submissions.`,
      author: 'Sarah Chen, WHAI',
      published_at: new Date('2024-10-08'),
      is_premium: false,
      view_count: 987,
      tags: ['cro', 'rwe', 'ma', 'clinical-trials'],
      verticals: ['cro', 'rwe', 'clinical-trials'],
      tas: ['Oncology', 'Rare Diseases / Orphan Drugs'],
    },
    {
      title: 'Wearables & Remote Monitoring: From Consumer to Clinical Grade',
      slug: 'wearables-clinical-grade-2025',
      content_type: 'ANALYSIS',
      summary: 'The line between consumer wearables and medical-grade remote monitoring is blurring. We examine FDA clearance trends, clinical evidence, and reimbursement progress for monitoring devices.',
      body: `## The Clinical Wearables Revolution\n\nOver 80 wearable devices now carry FDA 510(k) clearance or De Novo authorisation for specific clinical indications. Cardiac monitoring leads, followed by continuous glucose monitoring.\n\n## BioSignal: A Case Study\n\nBioSignal Wearables has navigated the transition from consumer cardiac devices to clinically validated remote monitoring particularly well. Their CE-marked and FDA-cleared devices are now used in formal cardiac surveillance programmes across 40+ countries.\n\n## The Reimbursement Evolution\n\nCMS remote physiological monitoring (RPM) codes have been the catalyst for clinical adoption in the US. Over 2.5M Medicare beneficiaries are now enrolled in RPM programmes, up from under 200K in 2020.\n\n## CardioSense and the Next Generation\n\nImplantable monitors like CardioSense\'s device represent the next frontier — more sensitive, continuous, and clinically actionable than wearables for high-risk patients.`,
      author: 'Dr. Marcus Lee, WHAI Medical Technology',
      published_at: new Date('2024-07-22'),
      is_premium: false,
      view_count: 1123,
      tags: ['wearables', 'remote-monitoring', 'cardiac', 'reimbursement'],
      verticals: ['wearables', 'remote-monitoring', 'implantables'],
      tas: ['Cardiovascular'],
    },
    {
      title: 'The Private Equity Playbook in Healthcare Services',
      slug: 'pe-healthcare-services-playbook',
      content_type: 'MARKET_REPORT',
      summary: 'Private equity-backed healthcare services consolidation has generated significant returns — and controversy. WHAI analyses the PE playbook across ambulatory care, behavioural health, and primary care.',
      body: `## The PE Healthcare Services Thesis\n\nPrivate equity has invested over $200B in healthcare services over the past decade. The thesis is consistent: fragmented markets, fee-for-service revenue, operational improvement opportunity.\n\n## The Ambulatory Opportunity\n\nAmbulatory surgery centres, urgent care, and speciality clinics have been the most active PE targets. The CareFirst Ambulatory acquisition by Sovereign Healthcare Capital is emblematic of this trend.\n\n## Behavioural Health: High Growth, High Scrutiny\n\nMental health and substance use disorder services have attracted significant PE interest, but also regulatory scrutiny around quality of care and staff-to-patient ratios.\n\n## The Value-Based Care Transition\n\nSome PE-backed providers are navigating the shift to value-based care — but this requires significant investment in technology and data infrastructure that can challenge short-term return expectations.`,
      author: 'Emma Blackwood, WHAI PE Coverage',
      published_at: new Date('2024-06-10'),
      is_premium: true,
      view_count: 1789,
      tags: ['private-equity', 'healthcare-services', 'ambulatory'],
      verticals: ['healthcare-pe-vc', 'ambulatory', 'behavioural-health'],
      tas: ['Mental Health / Psychiatry'],
    },
    {
      title: 'WHAI Podcast: The Future of Agentic AI in Clinical Practice',
      slug: 'whai-podcast-agentic-ai-clinical',
      content_type: 'PODCAST_SUMMARY',
      summary: 'In this episode of the WHAI Podcast, we speak with Hiroshi Yamamoto (CEO, Synapse Clinical AI) and Dr. Simon Fellowes (CDIO, NHS England Digital) about the promise and perils of agentic AI in clinical settings.',
      body: `## Episode Overview\n\nIn this wide-ranging conversation, Hiroshi Yamamoto and Dr. Simon Fellowes discuss the current state of agentic AI deployment in healthcare, focusing on clinical documentation, care coordination, and the governance frameworks needed to deploy AI safely.\n\n## Key Themes\n\n**Clinical documentation is the beachhead.** Yamamoto argues that clinical documentation automation is where agentic AI delivers unambiguous ROI today. "If you can give physicians 90 minutes back per day, that\'s the most valuable thing technology has ever done for clinical care."\n\n**NHS is moving deliberately.** Fellowes acknowledges the pressure to adopt AI faster, but emphasises the NHS\'s responsibility to ensure patient safety. "We won\'t cut corners on governance just because a vendor has a good demo."\n\n**The governance gap.** Both agree that the biggest challenge facing agentic AI in healthcare is not technical capability but governance frameworks that can move at the speed of AI development.\n\n## Listener Takeaways\n\nThe future of agentic AI in clinical practice is closer than many think — but getting there requires healthcare providers, regulators, and AI companies to work together on new governance models.`,
      author: 'WHAI Podcast Team',
      published_at: new Date('2024-05-01'),
      is_premium: false,
      view_count: 2567,
      tags: ['podcast', 'agentic-ai', 'nhs', 'clinical-practice'],
      verticals: ['agentic-ai', 'government-public-health'],
      tas: [],
    },
    {
      title: 'Oncology Drug Pricing: The Growing Pressure on Pharma',
      slug: 'oncology-drug-pricing-2025',
      content_type: 'ANALYSIS',
      summary: 'The Inflation Reduction Act, EU HTA regulation, and payer pressure are fundamentally reshaping how oncology drugs are priced and accessed globally. What does this mean for pharma pipelines?',
      body: `## The New Pricing Environment\n\nThe landscape for oncology drug pricing has shifted materially since 2022. CMS negotiation under the IRA, combined with EU Joint Clinical Assessment (JCA) under the new HTA regulation, is creating a more challenging commercial environment for high-priced oncology therapies.\n\n## IRA Impact: Early Signs\n\nThe first 10 drugs subject to CMS negotiation saw price reductions averaging 38-79%. While the directly affected drugs are largely older, the signalling effect on pricing expectations for launches is significant.\n\n## Pipeline Implications\n\nThere is early evidence that pharma companies are adjusting their pipeline strategies in response to pricing pressure — deprioritising indications with smaller patient populations or where payers have signalled resistance.\n\n## The HEOR Imperative\n\nHealth economics and outcomes research (HEOR) is becoming more strategically important. Companies like Global Health Economics Ltd and RealEvidence Analytics are seeing growing demand for robust real-world evidence to support market access and reimbursement submissions.`,
      author: 'Dr. Helen Pearce, Global Health Economics Ltd',
      published_at: new Date('2024-04-12'),
      is_premium: true,
      view_count: 1654,
      tags: ['drug-pricing', 'oncology', 'ira', 'heor'],
      verticals: ['large-pharma', 'specialty-pharma', 'payer-insurance'],
      tas: ['Oncology', 'Rare Diseases / Orphan Drugs'],
    },
  ]

  for (const insight of insightData) {
    const { verticals: iverts, tas: itas, ...insightFields } = insight
    const saved = await prisma.insight.upsert({
      where: { slug: insightFields.slug },
      update: {},
      create: { ...insightFields, tags: insightFields.tags ?? [] },
    })
    for (const v of iverts) {
      const vid = verticalMap[v]
      if (vid) await prisma.insightVertical.upsert({
        where: { insight_id_vertical_id: { insight_id: saved.id, vertical_id: vid } },
        update: {},
        create: { insight_id: saved.id, vertical_id: vid },
      })
    }
    for (const ta of itas) {
      const tid = taMap[ta]
      if (tid) await prisma.insightTherapeuticArea.upsert({
        where: { insight_id_therapeutic_area_id: { insight_id: saved.id, therapeutic_area_id: tid } },
        update: {},
        create: { insight_id: saved.id, therapeutic_area_id: tid },
      })
    }
  }
  console.log(`  → Created ${insightData.length} insights`)

  console.log('✅ WHAI seed complete!')
}

main().catch(console.error).finally(async () => { await prisma.$disconnect() })
