import { apiRequest } from '@/lib/api';

export async function loadOwnerBaseData() {
  const [petsR, remindersR, appointmentsR, invoicesR] = await Promise.allSettled([
    apiRequest('/api/v1/pets'),
    apiRequest('/api/v1/reminders?upcoming_days=120&limit=200'),
    apiRequest('/api/v1/appointments?mine=true'),
    apiRequest('/api/v1/owner/invoices'),
  ]);

  if (petsR.status === 'rejected') {
    throw petsR.reason;
  }
  const petsPayload = petsR.value;
  const remindersPayload = remindersR.status === 'fulfilled' ? remindersR.value : [];
  const appointmentsPayload = appointmentsR.status === 'fulfilled' ? appointmentsR.value : [];
  const invoicesPayload = invoicesR.status === 'fulfilled' ? invoicesR.value : [];

  return {
    pets: Array.isArray(petsPayload) ? petsPayload : [],
    reminders: Array.isArray(remindersPayload) ? remindersPayload : [],
    appointments: Array.isArray(appointmentsPayload) ? appointmentsPayload : [],
    invoices: Array.isArray(invoicesPayload) ? invoicesPayload : [],
  };
}

export async function loadPetHealthBundle(petId) {
  if (!petId) {
    return {
      visits: [],
      documents: [],
      vaccines: [],
      prescriptionsByVisit: {},
      prescriptions: [],
    };
  }

  const [visitsPayload, documentsPayload, vaccinesPayload] = await Promise.all([
    apiRequest(`/api/v1/visits?pet_id=${encodeURIComponent(petId)}&limit=80`),
    apiRequest(`/api/v1/documents?pet_id=${encodeURIComponent(petId)}`),
    apiRequest(`/api/v1/pets/${encodeURIComponent(petId)}/vaccines`),
  ]);

  const visits = Array.isArray(visitsPayload) ? visitsPayload : [];
  const documents = Array.isArray(documentsPayload) ? documentsPayload : [];
  const vaccines = Array.isArray(vaccinesPayload) ? vaccinesPayload : [];

  const prescriptionPayloads = await Promise.allSettled(
    visits.slice(0, 24).map((visit) => apiRequest(`/api/v1/visits/${encodeURIComponent(visit.id)}/prescriptions`))
  );

  const prescriptionsByVisit = {};
  const prescriptions = [];
  prescriptionPayloads.forEach((result, index) => {
    const visitId = visits[index]?.id;
    if (!visitId) return;
    const rows = result.status === 'fulfilled' && Array.isArray(result.value) ? result.value : [];
    prescriptionsByVisit[visitId] = rows;
    prescriptions.push(...rows);
  });

  return {
    visits,
    documents,
    vaccines,
    prescriptionsByVisit,
    prescriptions,
  };
}

export async function loadOwnerServicesData() {
  const [clinicsPayload, insurancePayload, referralsPayload] = await Promise.allSettled([
    apiRequest('/api/v1/market/clinics?limit=12'),
    apiRequest('/api/v1/owner/insurance/claims'),
    apiRequest('/api/v1/referrals/my'),
  ]);

  return {
    clinics: clinicsPayload.status === 'fulfilled' ? clinicsPayload.value?.items || clinicsPayload.value || [] : [],
    insuranceClaims: insurancePayload.status === 'fulfilled' && Array.isArray(insurancePayload.value) ? insurancePayload.value : [],
    referrals: referralsPayload.status === 'fulfilled' && Array.isArray(referralsPayload.value) ? referralsPayload.value : [],
  };
}

export async function loadKnowledgeData(query = '') {
  const q = encodeURIComponent(query || '');
  const [diseasesPayload, symptomsPayload] = await Promise.all([
    apiRequest(`/api/v1/diseases${query ? `/search?q=${q}&limit=12` : '?limit=12'}`),
    apiRequest(`/api/v1/symptoms${query ? `/search?q=${q}&limit=12` : '?limit=12'}`),
  ]);

  return {
    diseases: diseasesPayload?.items || diseasesPayload || [],
    symptoms: symptomsPayload?.items || symptomsPayload || [],
  };
}
