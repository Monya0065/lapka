'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import AppImage from '@/components/ui/AppImage';
import Card from '@/components/ui/Card';
import Skeleton from '@/components/ui/Skeleton';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import ShowcasePanel from '@/components/ui/ShowcasePanel';
import { apiRequest } from '@/lib/api';
import { getStoredSession } from '@/lib/auth';
import { resolvePetPhoto } from '@/lib/pets';
import YandexPlacesMap from '@/components/maps/YandexPlacesMap';

function formatDate(value, locale = 'ru-RU') {
  if (!value) return '—';
  return new Date(value).toLocaleString(locale);
}

export default function LostPetsPage() {
  const { i18n } = useTranslation();
  const lang = i18n.language === 'en' ? 'en' : 'ru';
  const locale = lang === 'en' ? 'en-US' : 'ru-RU';
  const tr = (ru, en) => (lang === 'en' ? en : ru);
  const [reports, setReports] = useState([]);
  const [allReports, setAllReports] = useState([]);
  const [ownerReports, setOwnerReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [cityFilter, setCityFilter] = useState('');
  const [radiusKm, setRadiusKm] = useState(20);
  const [geoPoint, setGeoPoint] = useState(null);
  const [recentHours, setRecentHours] = useState(72);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [saving, setSaving] = useState(false);
  const [promoBusy, setPromoBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [promoPayments, setPromoPayments] = useState([]);
  const [promoCheckout, setPromoCheckout] = useState(null);
  const [clinicNotifyBusy, setClinicNotifyBusy] = useState(false);
  const [clinicNotifyRadius, setClinicNotifyRadius] = useState(25);
  const [nearbyClinics, setNearbyClinics] = useState([]);
  const [nearbyClinicsLoading, setNearbyClinicsLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatThreads, setChatThreads] = useState([]);
  const [chatBusy, setChatBusy] = useState(false);
  const [chatRecipientId, setChatRecipientId] = useState('');
  const [chatForm, setChatForm] = useState({ message: '' });
  const [aiBusy, setAiBusy] = useState(false);
  const [aiAssist, setAiAssist] = useState(null);
  const [abuseBusy, setAbuseBusy] = useState(false);
  const [abuseForm, setAbuseForm] = useState({ reason: 'spam', message: '' });
  const [hotspotBusy, setHotspotBusy] = useState(false);
  const [hotspotSubs, setHotspotSubs] = useState([]);
  const [hotspotPrefs, setHotspotPrefs] = useState({
    in_app_enabled: true,
    email_enabled: false,
    sms_enabled: false,
    quiet_hours_start: '',
    quiet_hours_end: '',
  });
  const [hotspotForm, setHotspotForm] = useState({
    city: '',
    center_lat: '',
    center_lng: '',
    radius_km: 5,
    min_hotspot_count: 3,
  });
  const [promoForm, setPromoForm] = useState({
    tier: 'boost',
    duration_days: 7,
    idempotency_key: '',
  });

  const [pets, setPets] = useState([]);
  const session = useMemo(() => getStoredSession(), []);
  const ownerMode = session?.role === 'owner';
  const loggedInMode = Boolean(session?.accessToken);

  const [lostForm, setLostForm] = useState({
    pet_id: '',
    city: lang === 'en' ? 'Saint Petersburg' : 'Санкт-Петербург',
    last_seen_location: '',
    last_seen_time: '',
    description: '',
    photo_url: '',
    last_seen_lat: '',
    last_seen_lng: '',
    contact_phone: '',
    allow_phone_public: false,
  });
  const [sightingForm, setSightingForm] = useState({
    reporter_name: '',
    reporter_contact: '',
    location_note: '',
    message: '',
  });
  const [selfServiceForm, setSelfServiceForm] = useState({
    pet_name: '',
    species: lang === 'en' ? 'Cat' : 'Кот',
    breed: '',
    color: '',
    city: lang === 'en' ? 'Saint Petersburg' : 'Санкт-Петербург',
    last_seen_location: '',
    last_seen_time: '',
    description: '',
    photo_url: '',
    last_seen_lat: '',
    last_seen_lng: '',
    contact_phone: '',
    allow_phone_public: false,
  });

  const ownerActiveCount = useMemo(
    () => ownerReports.filter((row) => row.status !== 'found').length,
    [ownerReports]
  );
  const ownerFoundCount = useMemo(
    () => ownerReports.filter((row) => row.status === 'found').length,
    [ownerReports]
  );

  const mapMarkers = useMemo(
    () =>
      reports
        .filter((report) => Number.isFinite(Number(report.last_seen_lat)) && Number.isFinite(Number(report.last_seen_lng)))
        .map((report) => ({
          id: report.id,
          lat: Number(report.last_seen_lat),
          lng: Number(report.last_seen_lng),
          title: `${report.pet_name}${report.is_promoted ? ' · promoted' : ''}`,
          subtitle: [report.city, report.last_seen_location].filter(Boolean).join(' · '),
          preset: report.is_promoted ? 'islands#orangeCircleDotIcon' : 'islands#blueCircleDotIcon',
          place: report,
        })),
    [reports]
  );

  const heatZones = useMemo(() => {
    const buckets = new Map();
    for (const marker of mapMarkers) {
      const latKey = Math.round(Number(marker.lat) * 100) / 100;
      const lngKey = Math.round(Number(marker.lng) * 100) / 100;
      const key = `${latKey}:${lngKey}`;
      const bucket = buckets.get(key) || { count: 0, lat: 0, lng: 0 };
      bucket.count += 1;
      bucket.lat += Number(marker.lat);
      bucket.lng += Number(marker.lng);
      buckets.set(key, bucket);
    }
    const zones = [];
    for (const [, bucket] of buckets) {
      if (bucket.count < 2) continue;
      const centerLat = bucket.lat / bucket.count;
      const centerLng = bucket.lng / bucket.count;
      zones.push({
        id: `heat-${centerLat}-${centerLng}`,
        lat: centerLat,
        lng: centerLng,
        radiusMeters: Math.min(2200, 450 + bucket.count * 220),
        fillColor: bucket.count >= 4 ? 'rgba(255, 69, 0, 0.32)' : 'rgba(255, 140, 66, 0.22)',
        strokeColor: bucket.count >= 4 ? '#ff3b00' : '#ff8c42',
        strokeWidth: 2,
        count: bucket.count,
      });
    }
    return zones.sort((a, b) => b.count - a.count).slice(0, 8);
  }, [mapMarkers]);

  const topHotspots = useMemo(
    () => [...heatZones].sort((a, b) => b.count - a.count).slice(0, 3),
    [heatZones]
  );

  const loadReports = useCallback(async (city = cityFilter) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (city?.trim()) params.set('city', city.trim());
      if (geoPoint?.lat && geoPoint?.lng) {
        params.set('lat', String(geoPoint.lat));
        params.set('lng', String(geoPoint.lng));
        params.set('radius_km', String(radiusKm));
      }
      const query = params.toString() ? `?${params.toString()}` : '';
      const payload = await apiRequest(`/api/v1/lost-pets${query}`, { auth: false });
      setAllReports(Array.isArray(payload) ? payload : []);
    } catch (requestError) {
      setError(requestError.message || (lang === 'en' ? 'Failed to load lost pet listings' : 'Не удалось загрузить объявления о потерянных питомцах'));
      setAllReports([]);
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, [cityFilter, geoPoint, lang, radiusKm]);

  const loadOwnerPets = useCallback(async () => {
    if (!ownerMode) return;
    try {
      const payload = await apiRequest('/api/v1/pets');
      const rows = Array.isArray(payload) ? payload : [];
      setPets(rows);
      if (rows[0] && !lostForm.pet_id) {
        setLostForm((prev) => ({ ...prev, pet_id: rows[0].id }));
      }
    } catch {
      setPets([]);
    }
  }, [lostForm.pet_id, ownerMode]);

  const loadOwnerReports = useCallback(async () => {
    if (!ownerMode) {
      setOwnerReports([]);
      return;
    }
    try {
      const payload = await apiRequest('/api/v1/owner/lost-pets/my?include_found=true');
      setOwnerReports(Array.isArray(payload) ? payload : []);
    } catch {
      setOwnerReports([]);
    }
  }, [ownerMode]);

  useEffect(() => {
    loadReports('');
    loadOwnerPets();
    loadOwnerReports();
  }, [loadOwnerPets, loadOwnerReports, loadReports]);

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, '').trim();
    if (!hash) return;
    openReport(hash);
    // Open shared deep-link once on first mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!geoPoint) return;
    loadReports(cityFilter);
  }, [cityFilter, geoPoint, loadReports, radiusKm]);

  useEffect(() => {
    const now = Date.now();
    const filtered = allReports.filter((item) => {
      if (!recentHours || recentHours >= 9999) return true;
      const source = item.last_seen_time || item.created_at;
      if (!source) return true;
      const ts = new Date(source).getTime();
      if (!Number.isFinite(ts)) return true;
      return now - ts <= recentHours * 60 * 60 * 1000;
    });
    setReports(filtered);
  }, [allReports, recentHours]);

  useEffect(() => {
    setPromoForm((prev) => ({ ...prev, idempotency_key: makePromoIdempotencyKey() }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!loggedInMode) {
      setHotspotSubs([]);
      return;
    }
    (async () => {
      try {
        const [rows, prefs] = await Promise.all([
          apiRequest('/api/v1/lost-pets/hotspots/subscriptions'),
          apiRequest('/api/v1/lost-pets/hotspots/notification-preferences'),
        ]);
        setHotspotSubs(Array.isArray(rows) ? rows : []);
        setHotspotPrefs({
          in_app_enabled: Boolean(prefs?.in_app_enabled),
          email_enabled: Boolean(prefs?.email_enabled),
          sms_enabled: Boolean(prefs?.sms_enabled),
          quiet_hours_start: prefs?.quiet_hours_start ?? '',
          quiet_hours_end: prefs?.quiet_hours_end ?? '',
        });
      } catch {
        setHotspotSubs([]);
      }
    })();
  }, [loggedInMode]);

  async function openReport(id) {
    setLoadingDetail(true);
    setError('');
    try {
      const payload = ownerMode
        ? await apiRequest(`/api/v1/owner/lost-pets/${id}`)
        : await apiRequest(`/api/v1/lost-pets/${id}`, { auth: false });
      setSelectedReport(payload || null);
      if (session?.accessToken) {
        const messages = await apiRequest(`/api/v1/lost-pets/${id}/chat/messages`);
        setChatMessages(Array.isArray(messages) ? messages : []);
        if (ownerMode) {
          const threads = await apiRequest(`/api/v1/owner/lost-pets/${id}/chat/threads`);
          const rows = Array.isArray(threads) ? threads : [];
          setChatThreads(rows);
          if (rows[0] && !chatRecipientId) {
            setChatRecipientId(rows[0].participant_user_id);
          }
        } else {
          setChatThreads([]);
          setChatRecipientId('');
        }
      } else {
        setChatMessages([]);
        setChatThreads([]);
        setChatRecipientId('');
      }
      setNearbyClinicsLoading(true);
      const clinics = await apiRequest(`/api/v1/lost-pets/${id}/nearby-clinics?radius_km=${encodeURIComponent(clinicNotifyRadius)}`, { auth: false });
      setNearbyClinics(Array.isArray(clinics) ? clinics : []);
      if (ownerMode) {
        const payments = await apiRequest(`/api/v1/owner/lost-pets/${id}/promotion/payments`);
        setPromoPayments(Array.isArray(payments) ? payments : []);
      } else {
        setPromoPayments([]);
      }
    } catch (requestError) {
      setError(requestError.message || tr('Не удалось открыть карточку', 'Failed to open listing details'));
      setSelectedReport(null);
      setChatMessages([]);
      setChatThreads([]);
      setChatRecipientId('');
    } finally {
      setNearbyClinicsLoading(false);
      setLoadingDetail(false);
    }
  }

  function makePromoIdempotencyKey() {
    return `promo-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  async function startPromotionCheckout() {
    if (!ownerMode || !selectedReport?.id) return;
    setPromoBusy(true);
    setError('');
    setSuccess('');
    try {
      const payload = await apiRequest(`/api/v1/owner/lost-pets/${selectedReport.id}/promotion/checkout`, {
        method: 'POST',
        body: {
          tier: promoForm.tier,
          duration_days: Number(promoForm.duration_days),
          idempotency_key: promoForm.idempotency_key || makePromoIdempotencyKey(),
        },
      });
      setPromoCheckout(payload?.payment || null);
      setSuccess(tr('Черновик оплаты продвижения создан. Подтвердите платеж.', 'Promotion payment draft created. Confirm the payment.'));
      const payments = await apiRequest(`/api/v1/owner/lost-pets/${selectedReport.id}/promotion/payments`);
      setPromoPayments(Array.isArray(payments) ? payments : []);
      setPromoForm((prev) => ({ ...prev, idempotency_key: '' }));
    } catch (requestError) {
      setError(requestError.message || tr('Не удалось создать оплату продвижения', 'Failed to create promotion payment'));
    } finally {
      setPromoBusy(false);
    }
  }

  async function confirmPromotionPayment(simulateResult) {
    if (!ownerMode || !selectedReport?.id || !promoCheckout?.id) return;
    setPromoBusy(true);
    setError('');
    setSuccess('');
    try {
      const payload = await apiRequest(`/api/v1/owner/lost-pets/${selectedReport.id}/promotion/confirm`, {
        method: 'POST',
        body: {
          payment_id: promoCheckout.id,
          simulate_result: simulateResult,
        },
      });
      const paymentStatus = payload?.payment?.status;
      if (paymentStatus === 'succeeded') {
        setSuccess(tr('Продвижение активировано. Объявление поднято в выдаче.', 'Promotion activated. Listing boosted in feed.'));
      } else {
        setError(tr('Оплата не прошла. Проверьте данные и повторите попытку.', 'Payment failed. Check details and retry.'));
      }
      setPromoCheckout(payload?.payment || null);
      await openReport(selectedReport.id);
      await loadReports(cityFilter);
      await loadOwnerReports();
    } catch (requestError) {
      setError(requestError.message || tr('Не удалось подтвердить оплату продвижения', 'Failed to confirm promotion payment'));
    } finally {
      setPromoBusy(false);
    }
  }

  async function notifyNearbyClinics() {
    if (!ownerMode || !selectedReport?.id) return;
    setClinicNotifyBusy(true);
    setError('');
    setSuccess('');
    try {
      const payload = await apiRequest(`/api/v1/owner/lost-pets/${selectedReport.id}/notify-clinics`, {
        method: 'POST',
        body: { radius_km: clinicNotifyRadius },
      });
      setSuccess(
        tr(
          `Уведомления отправлены: клиник ${payload?.notified_clinics || 0}, получателей ${payload?.notified_users || 0}.`,
          `Notifications sent: clinics ${payload?.notified_clinics || 0}, recipients ${payload?.notified_users || 0}.`
        )
      );
      const clinics = await apiRequest(`/api/v1/lost-pets/${selectedReport.id}/nearby-clinics?radius_km=${encodeURIComponent(clinicNotifyRadius)}`, { auth: false });
      setNearbyClinics(Array.isArray(clinics) ? clinics : []);
    } catch (requestError) {
      setError(requestError.message || tr('Не удалось уведомить клиники рядом', 'Failed to notify nearby clinics'));
    } finally {
      setClinicNotifyBusy(false);
    }
  }

  async function sendChatMessage(event) {
    event.preventDefault();
    if (!selectedReport?.id || !chatForm.message.trim()) return;
    if (!session?.accessToken) {
      setError(tr('Для переписки нужно войти в личный кабинет.', 'Sign in to use chat.'));
      return;
    }
    setChatBusy(true);
    setError('');
    setSuccess('');
    try {
      const body = {
        message: chatForm.message.trim(),
      };
      if (ownerMode && chatRecipientId) {
        body.recipient_user_id = chatRecipientId;
      }
      await apiRequest(`/api/v1/lost-pets/${selectedReport.id}/chat/messages`, {
        method: 'POST',
        body,
      });
      setChatForm({ message: '' });
      const messages = await apiRequest(`/api/v1/lost-pets/${selectedReport.id}/chat/messages`);
      setChatMessages(Array.isArray(messages) ? messages : []);
      if (ownerMode) {
        const threads = await apiRequest(`/api/v1/owner/lost-pets/${selectedReport.id}/chat/threads`);
        setChatThreads(Array.isArray(threads) ? threads : []);
      }
      setSuccess(tr('Сообщение отправлено.', 'Message sent.'));
    } catch (requestError) {
      setError(requestError.message || tr('Не удалось отправить сообщение в чат', 'Failed to send chat message'));
    } finally {
      setChatBusy(false);
    }
  }

  async function submitAbuseReport(event) {
    event.preventDefault();
    if (!selectedReport?.id) return;
    setAbuseBusy(true);
    setError('');
    setSuccess('');
    try {
      await apiRequest(`/api/v1/lost-pets/${selectedReport.id}/abuse-report`, {
        method: 'POST',
        auth: Boolean(session?.accessToken),
        body: {
          reason: abuseForm.reason,
          message: abuseForm.message || null,
        },
      });
      setSuccess(tr('Жалоба отправлена в модерацию.', 'Report sent to moderation.'));
      setAbuseForm({ reason: 'spam', message: '' });
    } catch (requestError) {
      setError(requestError.message || tr('Не удалось отправить жалобу', 'Failed to send report'));
    } finally {
      setAbuseBusy(false);
    }
  }

  async function submitLostReport(event) {
    event.preventDefault();
    if (!ownerMode) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await apiRequest('/api/v1/owner/lost-pets', {
        method: 'POST',
        body: {
          ...lostForm,
          last_seen_time: new Date(lostForm.last_seen_time).toISOString(),
          photo_url: lostForm.photo_url || null,
          last_seen_lat: lostForm.last_seen_lat ? Number(lostForm.last_seen_lat) : null,
          last_seen_lng: lostForm.last_seen_lng ? Number(lostForm.last_seen_lng) : null,
          contact_phone: lostForm.contact_phone || null,
        },
      });
      setSuccess(tr('Объявление опубликовано. Оно уже отображается на публичной странице.', 'Listing published. It is now visible on the public page.'));
      setLostForm((prev) => ({
        ...prev,
        last_seen_location: '',
        last_seen_time: '',
        description: '',
        photo_url: '',
        last_seen_lat: '',
        last_seen_lng: '',
        contact_phone: '',
        allow_phone_public: false,
      }));
      await loadReports();
      await loadOwnerReports();
    } catch (requestError) {
      setError(requestError.message || tr('Не удалось создать объявление', 'Failed to create listing'));
    } finally {
      setSaving(false);
    }
  }

  async function runAiEnhanceForOwnerForm() {
    if (!session?.accessToken) {
      setError(tr('Для AI-помощника нужно войти в личный кабинет.', 'Sign in to use AI assistant.'));
      return;
    }
    setAiBusy(true);
    setError('');
    try {
      const pet = pets.find((item) => item.id === lostForm.pet_id);
      const payload = await apiRequest('/api/v1/lost-pets/ai/enhance-description', {
        method: 'POST',
        body: {
          pet_name: pet?.name || null,
          species: pet?.species || null,
          breed: pet?.breed || null,
          color: pet?.color || null,
          city: lostForm.city || null,
          last_seen_location: lostForm.last_seen_location || null,
          last_seen_time: lostForm.last_seen_time ? new Date(lostForm.last_seen_time).toISOString() : null,
          contact_phone: lostForm.contact_phone || null,
          description: lostForm.description || '',
        },
      });
      setAiAssist(payload || null);
      if (payload?.enhanced_description) {
        setLostForm((prev) => ({ ...prev, description: payload.enhanced_description }));
      }
    } catch (requestError) {
      setError(requestError.message || tr('Не удалось получить AI-подсказки', 'Failed to get AI suggestions'));
    } finally {
      setAiBusy(false);
    }
  }

  async function runAiEnhanceForSelfServiceForm() {
    if (!session?.accessToken) {
      setError(tr('Для AI-помощника нужно войти в личный кабинет.', 'Sign in to use AI assistant.'));
      return;
    }
    setAiBusy(true);
    setError('');
    try {
      const payload = await apiRequest('/api/v1/lost-pets/ai/enhance-description', {
        method: 'POST',
        body: {
          pet_name: selfServiceForm.pet_name || null,
          species: selfServiceForm.species || null,
          breed: selfServiceForm.breed || null,
          color: selfServiceForm.color || null,
          city: selfServiceForm.city || null,
          last_seen_location: selfServiceForm.last_seen_location || null,
          last_seen_time: selfServiceForm.last_seen_time ? new Date(selfServiceForm.last_seen_time).toISOString() : null,
          contact_phone: selfServiceForm.contact_phone || null,
          description: selfServiceForm.description || '',
        },
      });
      setAiAssist(payload || null);
      if (payload?.enhanced_description) {
        setSelfServiceForm((prev) => ({ ...prev, description: payload.enhanced_description }));
      }
    } catch (requestError) {
      setError(requestError.message || tr('Не удалось получить AI-подсказки', 'Failed to get AI suggestions'));
    } finally {
      setAiBusy(false);
    }
  }

  async function submitSighting(event) {
    event.preventDefault();
    if (!selectedReport?.id) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await apiRequest(`/api/v1/lost-pets/${selectedReport.id}/sightings`, {
        method: 'POST',
        auth: false,
        body: sightingForm,
      });
      setSuccess(tr('Спасибо. Сообщение отправлено владельцу.', 'Thanks. Message sent to the owner.'));
      setSightingForm({ reporter_name: '', reporter_contact: '', location_note: '', message: '' });
      await openReport(selectedReport.id);
    } catch (requestError) {
      setError(requestError.message || tr('Не удалось отправить сообщение', 'Failed to send message'));
    } finally {
      setSaving(false);
    }
  }

  async function submitSelfServiceLostReport(event) {
    event.preventDefault();
    if (!loggedInMode) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await apiRequest('/api/v1/lost-pets/self-service', {
        method: 'POST',
        body: {
          ...selfServiceForm,
          last_seen_time: new Date(selfServiceForm.last_seen_time).toISOString(),
          photo_url: selfServiceForm.photo_url || null,
          last_seen_lat: selfServiceForm.last_seen_lat ? Number(selfServiceForm.last_seen_lat) : null,
          last_seen_lng: selfServiceForm.last_seen_lng ? Number(selfServiceForm.last_seen_lng) : null,
          contact_phone: selfServiceForm.contact_phone || null,
        },
      });
      setSuccess(tr('Объявление опубликовано в self-service режиме.', 'Listing published in self-service mode.'));
      setSelfServiceForm((prev) => ({
        ...prev,
        pet_name: '',
        breed: '',
        color: '',
        last_seen_location: '',
        last_seen_time: '',
        description: '',
        photo_url: '',
        last_seen_lat: '',
        last_seen_lng: '',
        contact_phone: '',
        allow_phone_public: false,
      }));
      await loadReports(cityFilter);
      await loadOwnerReports();
    } catch (requestError) {
      setError(requestError.message || tr('Не удалось создать self-service объявление', 'Failed to create self-service listing'));
    } finally {
      setSaving(false);
    }
  }

  async function markFound(reportId) {
    if (!ownerMode || !reportId) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await apiRequest(`/api/v1/owner/lost-pets/${reportId}/mark-found`, {
        method: 'POST',
      });
      setSuccess(tr('Отлично, объявление закрыто как найденное.', 'Great, listing marked as found.'));
      await loadReports(cityFilter);
      await loadOwnerReports();
      if (selectedReport?.id === reportId) {
        await openReport(reportId);
      }
    } catch (requestError) {
      setError(requestError.message || tr('Не удалось закрыть объявление', 'Failed to close listing'));
    } finally {
      setSaving(false);
    }
  }

  async function copyShareLink(reportId) {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/lost-pets#${reportId}`);
      setSuccess(tr('Ссылка на объявление скопирована.', 'Listing link copied.'));
    } catch {
      setError(tr('Не удалось скопировать ссылку.', 'Failed to copy link.'));
    }
  }

  function detectNearby() {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setError(tr('Геолокация недоступна в этом браузере.', 'Geolocation is not available in this browser.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = Number(position.coords.latitude.toFixed(6));
        const lng = Number(position.coords.longitude.toFixed(6));
        setGeoPoint({ lat, lng });
        setHotspotForm((prev) => ({ ...prev, center_lat: String(lat), center_lng: String(lng) }));
      },
      () => {
        setError(tr('Не удалось получить геопозицию. Разрешите доступ к геолокации.', 'Failed to get geolocation. Please allow location access.'));
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function createHotspotSubscription(event) {
    event.preventDefault();
    if (!loggedInMode) return;
    setHotspotBusy(true);
    setError('');
    setSuccess('');
    try {
      await apiRequest('/api/v1/lost-pets/hotspots/subscriptions', {
        method: 'POST',
        body: {
          city: hotspotForm.city || null,
          center_lat: Number(hotspotForm.center_lat),
          center_lng: Number(hotspotForm.center_lng),
          radius_km: Number(hotspotForm.radius_km || 5),
          min_hotspot_count: Number(hotspotForm.min_hotspot_count || 3),
          is_active: true,
        },
      });
      const rows = await apiRequest('/api/v1/lost-pets/hotspots/subscriptions');
      setHotspotSubs(Array.isArray(rows) ? rows : []);
      setSuccess(tr('Подписка на горячую зону создана.', 'Hotspot subscription created.'));
    } catch (requestError) {
      setError(requestError.message || tr('Не удалось создать подписку на горячую зону', 'Failed to create hotspot subscription'));
    } finally {
      setHotspotBusy(false);
    }
  }

  async function deleteHotspotSubscription(id) {
    setHotspotBusy(true);
    setError('');
    setSuccess('');
    try {
      await apiRequest(`/api/v1/lost-pets/hotspots/subscriptions/${id}`, { method: 'DELETE' });
      const rows = await apiRequest('/api/v1/lost-pets/hotspots/subscriptions');
      setHotspotSubs(Array.isArray(rows) ? rows : []);
      setSuccess(tr('Подписка удалена.', 'Subscription deleted.'));
    } catch (requestError) {
      setError(requestError.message || tr('Не удалось удалить подписку', 'Failed to delete subscription'));
    } finally {
      setHotspotBusy(false);
    }
  }

  async function saveHotspotPreferences(event) {
    event.preventDefault();
    if (!loggedInMode) return;
    setHotspotBusy(true);
    setError('');
    setSuccess('');
    try {
      const payload = await apiRequest('/api/v1/lost-pets/hotspots/notification-preferences', {
        method: 'POST',
        body: {
          in_app_enabled: Boolean(hotspotPrefs.in_app_enabled),
          email_enabled: Boolean(hotspotPrefs.email_enabled),
          sms_enabled: Boolean(hotspotPrefs.sms_enabled),
          quiet_hours_start: hotspotPrefs.quiet_hours_start === '' ? null : Number(hotspotPrefs.quiet_hours_start),
          quiet_hours_end: hotspotPrefs.quiet_hours_end === '' ? null : Number(hotspotPrefs.quiet_hours_end),
        },
      });
      setHotspotPrefs({
        in_app_enabled: Boolean(payload?.in_app_enabled),
        email_enabled: Boolean(payload?.email_enabled),
        sms_enabled: Boolean(payload?.sms_enabled),
        quiet_hours_start: payload?.quiet_hours_start ?? '',
        quiet_hours_end: payload?.quiet_hours_end ?? '',
      });
      setSuccess(tr('Настройки каналов hotspot-уведомлений сохранены.', 'Hotspot notification channel settings saved.'));
    } catch (requestError) {
      setError(requestError.message || tr('Не удалось сохранить настройки уведомлений', 'Failed to save notification settings'));
    } finally {
      setHotspotBusy(false);
    }
  }

  return (
    <main className="page-wrap py-6">
      <section className="space-y-4">
        {error ? <ErrorBanner message={error} onRetry={() => loadReports(cityFilter)} /> : null}
        {success ? (
          <div className="callout-success">{success}</div>
        ) : null}

        <section className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-orange-400/14 via-surface-muted to-rose-400/12 p-5 shadow-card md:p-8 dark:from-orange-500/10 dark:to-rose-500/10">
          <div className="relative grid gap-6 lg:grid-cols-[1.05fr_1fr] lg:items-start">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-theme-muted">{tr('Публичная лента', 'Public feed')}</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-theme md:text-4xl">{tr('Потерявшиеся питомцы', 'Lost pets')}</h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-theme-muted md:text-base">
                {tr(
                  'Публичный поиск без медкарты. Объявления и сообщения — в безопасном контуре; владелец управляет карточками после входа.',
                  'Public search without medical record disclosure. Listings and messages stay in a safe flow; owners manage cards after sign-in.',
                )}
              </p>
              <div className="mt-4">
                <button className="btn-secondary" type="button" disabled={loading} onClick={() => loadReports(cityFilter)}>
                  {tr('Обновить', 'Refresh')}
                </button>
              </div>
            </div>
            {loading ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-24 w-full rounded-2xl" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {[
                  { label: tr('В ленте', 'In feed'), value: reports.length, tone: '' },
                  { label: tr('Город', 'City'), value: cityFilter.trim() || tr('Все', 'All'), tone: 'text-sky-700 dark:text-sky-300' },
                  { label: ownerMode ? tr('Мои активные', 'My active') : tr('Вход', 'Login'), value: ownerMode ? ownerActiveCount : '—', tone: ownerMode ? 'text-amber-700 dark:text-amber-300' : '' },
                  { label: ownerMode ? tr('Мои закрытые', 'My closed') : tr('Роль', 'Role'), value: ownerMode ? ownerFoundCount : tr('Гость', 'Guest'), tone: ownerMode ? 'text-emerald-700 dark:text-emerald-300' : 'text-violet-700 dark:text-violet-300' },
                  { label: tr('С фото', 'With photo'), value: reports.filter((r) => Boolean(r.photo_url)).length, tone: 'text-violet-700 dark:text-violet-300' },
                  { label: tr('Активные', 'Active'), value: reports.filter((r) => r.status !== 'found').length, tone: 'text-rose-700 dark:text-rose-300' },
                ].map((cell) => (
                  <div key={cell.label} className="rounded-2xl border border-border bg-surface/90 px-3 py-4 shadow-sm">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-theme-muted">{cell.label}</p>
                    <p className={`mt-1 break-words text-xl font-black tabular-nums sm:text-2xl ${cell.tone || 'text-theme'}`}>{cell.value}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <ShowcasePanel
          eyebrow={tr('Публичный поиск', 'Public search')}
          title={tr('Поиск потерявшегося питомца без раскрытия медкарты', 'Find a lost pet without exposing medical records')}
          description={tr('Объявление показывает только безопасные публичные данные, а связь с владельцем идёт через защищённое сообщение. Так интерфейс остаётся понятным для людей и безопасным для владельца.', 'Listings show only safe public data, and owner contact goes through protected messaging. The interface stays clear for people and safe for owners.')}
          imageSrc="/assets/img/owner-banner.svg"
          imageAlt={tr('Публичный поиск потерявшегося питомца', 'Public lost pet search')}
          badges={[
            lang === 'en' ? `${reports.length} listings` : `${reports.length} объявлений`,
            ownerMode ? tr('Можно добавить объявление', 'You can add a listing') : tr('Просмотр открыт всем', 'Open for everyone'),
            tr('Безопасные публичные данные', 'Safe public data'),
          ]}
          compact
        />

        <section className="grid gap-4 xl:grid-cols-[248px_minmax(0,1fr)] 2xl:grid-cols-[248px_minmax(0,1fr)_360px]">
          <aside className="space-y-4 xl:sticky xl:top-[96px] xl:self-start">
            <Card title={tr('Навигация', 'Navigation')} subtitle={tr('Быстрые переходы по публичным сервисам', 'Quick links across public services')}>
              <div className="grid gap-2">
                <Link href="/" className="sidebar-link">{tr('← На главную', '< Back to home')}</Link>
                <Link href="/owner/map" className="sidebar-link">{tr('Карта рядом', 'Map nearby')}</Link>
                <Link href="/owner/passport-center" className="sidebar-link">{tr('QR-паспорт', 'QR passport')}</Link>
                <Link href="/owner/dashboard" className="sidebar-link">{tr('Кабинет владельца', 'Owner workspace')}</Link>
              </div>
            </Card>
            <Card title={tr('Что доступно здесь', 'What is available here')} subtitle={tr('Только безопасные публичные данные', 'Only safe public data')}>
              <ul className="space-y-2 text-sm text-theme">
                <li>• {tr('Объявления о пропаже', 'Lost pet listings')}</li>
                <li>• {tr('Фото и приметы питомца', 'Photo and pet signs')}</li>
                <li>• {tr('Связь с владельцем без раскрытия медкарты', 'Owner contact without medical record disclosure')}</li>
              </ul>
            </Card>
          </aside>

          <div className="space-y-4">
            <Card title={tr('Поиск', 'Search')} subtitle={tr('Фильтр по городу, гео-поиск рядом и интерактивная карта потеряшек', 'City filter, nearby geosearch, and interactive lost-pets map')}>
              <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
                <label className="block">
                  <span className="label">{tr('Город', 'City')}</span>
                  <input
                    className="input"
                    value={cityFilter}
                    onChange={(event) => setCityFilter(event.target.value)}
                    placeholder={tr('Санкт-Петербург', 'Saint Petersburg')}
                  />
                </label>
                <button className="btn-primary" type="button" onClick={() => loadReports(cityFilter)}>
                  {tr('Применить', 'Apply')}
                </button>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-[auto_132px_150px_auto] md:items-end">
                <button className="btn-secondary" type="button" onClick={detectNearby}>
                  {geoPoint ? tr('Обновить мою геопозицию', 'Refresh my geolocation') : tr('Показать рядом со мной', 'Show near me')}
                </button>
                <label className="block">
                  <span className="label">{tr('Радиус, км', 'Radius, km')}</span>
                  <input
                    className="input"
                    type="number"
                    min={1}
                    max={300}
                    value={radiusKm}
                    onChange={(event) => setRadiusKm(Number(event.target.value || 20))}
                  />
                </label>
                <label className="block">
                  <span className="label">{tr('Свежесть', 'Freshness')}</span>
                  <select
                    className="input"
                    value={recentHours}
                    onChange={(event) => setRecentHours(Number(event.target.value))}
                  >
                    <option value={24}>{tr('24 часа', '24 hours')}</option>
                    <option value={72}>{tr('72 часа', '72 hours')}</option>
                    <option value={168}>{tr('7 дней', '7 days')}</option>
                    <option value={9999}>{tr('Все', 'All')}</option>
                  </select>
                </label>
                <div className="text-xs text-theme-muted">
                  {geoPoint ? `${tr('Координаты', 'Coordinates')}: ${geoPoint.lat}, ${geoPoint.lng}` : tr('Геопоиск выключен', 'Geosearch is off')}
                </div>
              </div>

              <div className="mt-4 rounded-3xl border border-border bg-surface-elevated p-4">
                <div className="mb-3 grid grid-cols-2 gap-2 text-xs text-theme md:grid-cols-4">
                  <div className="rounded-xl bg-surface/85 px-3 py-2">{tr('Пинов на карте', 'Pins on map')}: {mapMarkers.length}</div>
                  <div className="rounded-xl bg-surface/85 px-3 py-2">
                    {tr('С геоточкой', 'With geolocation')}: {reports.filter((r) => Number.isFinite(Number(r.last_seen_lat)) && Number.isFinite(Number(r.last_seen_lng))).length}
                  </div>
                  <div className="rounded-xl bg-surface/85 px-3 py-2">Promoted: {reports.filter((r) => r.is_promoted).length}</div>
                  <div className="rounded-xl bg-surface/85 px-3 py-2">{tr('Heat-зон', 'Heat zones')}: {heatZones.length}</div>
                </div>
                {mapMarkers.length ? (
                  <>
                    <YandexPlacesMap
                      markers={mapMarkers}
                      heatCircles={heatZones}
                      enableCluster
                      height={360}
                      onMarkerClick={({ place }) => openReport(place?.id)}
                    />
                    <div className="mt-2 grid gap-2 md:grid-cols-3">
                      {topHotspots.length ? (
                        topHotspots.map((zone, idx) => (
                          <div key={zone.id} className="rounded-xl border border-border bg-surface/85 px-3 py-2 text-xs text-theme">
                            <p className="font-semibold">Hotspot #{idx + 1}</p>
                            <p>{tr('Сгущение', 'Cluster')}: {zone.count} {tr('объявлений', 'listings')}</p>
                            <p>{tr('Радиус', 'Radius')}: ~{Math.round(zone.radiusMeters)} {tr('м', 'm')}</p>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-xl border border-border bg-surface/85 px-3 py-2 text-xs text-theme-muted md:col-span-3">
                          {tr('Пока нет плотных кластеров. Heat-зоны появятся при 2+ объявлениях рядом.', 'No dense clusters yet. Heat zones appear when 2+ listings are close together.')}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="rounded-2xl border border-dashed border-border px-3 py-8 text-center text-sm text-theme-muted">
                    {tr('На карте пока нет точек. Добавьте координаты в объявлениях или включите другой город.', 'No points on map yet. Add coordinates to listings or switch city.')}
                  </div>
                )}
              </div>
            </Card>

            <Card title={tr('Подписка на горячую зону', 'Hotspot subscription')} subtitle={tr('Автоуведомления при всплеске пропаж в выбранном радиусе', 'Auto alerts when losses spike in your selected radius')}>
              {loggedInMode ? (
                <>
                  <form className="grid gap-3 md:grid-cols-2" onSubmit={createHotspotSubscription}>
                    <label className="block">
                      <span className="label">{tr('Город (опционально)', 'City (optional)')}</span>
                      <input
                        className="input"
                        value={hotspotForm.city}
                        onChange={(event) => setHotspotForm((prev) => ({ ...prev, city: event.target.value }))}
                        placeholder={tr('Санкт-Петербург', 'Saint Petersburg')}
                      />
                    </label>
                    <label className="block">
                      <span className="label">{tr('Радиус, км', 'Radius, km')}</span>
                      <input
                        className="input"
                        type="number"
                        min={1}
                        max={100}
                        value={hotspotForm.radius_km}
                        onChange={(event) => setHotspotForm((prev) => ({ ...prev, radius_km: event.target.value }))}
                      />
                    </label>
                    <label className="block">
                      <span className="label">{tr('Широта центра', 'Center latitude')}</span>
                      <input
                        className="input"
                        type="number"
                        step="0.000001"
                        value={hotspotForm.center_lat}
                        onChange={(event) => setHotspotForm((prev) => ({ ...prev, center_lat: event.target.value }))}
                        required
                      />
                    </label>
                    <label className="block">
                      <span className="label">{tr('Долгота центра', 'Center longitude')}</span>
                      <input
                        className="input"
                        type="number"
                        step="0.000001"
                        value={hotspotForm.center_lng}
                        onChange={(event) => setHotspotForm((prev) => ({ ...prev, center_lng: event.target.value }))}
                        required
                      />
                    </label>
                    <label className="block md:col-span-2">
                      <span className="label">{tr('Порог hotspot (объявлений за 72 часа)', 'Hotspot threshold (listings in 72 hours)')}</span>
                      <input
                        className="input"
                        type="number"
                        min={2}
                        max={20}
                        value={hotspotForm.min_hotspot_count}
                        onChange={(event) => setHotspotForm((prev) => ({ ...prev, min_hotspot_count: event.target.value }))}
                      />
                    </label>
                    <button className="btn-primary md:col-span-2" type="submit" disabled={hotspotBusy}>
                      {hotspotBusy ? tr('Сохраняем подписку...', 'Saving subscription...') : tr('Подписаться на горячую зону', 'Subscribe to hotspot')}
                    </button>
                  </form>
                  {hotspotSubs.length ? (
                    <div className="mt-3 space-y-2">
                      {hotspotSubs.map((sub) => (
                        <div key={sub.id} className="rounded-xl border border-border bg-surface-muted/70 px-3 py-2 text-sm">
                          <p className="font-semibold text-theme">
                            {sub.city || tr('Любой город', 'Any city')} · {sub.radius_km} {tr('км', 'km')} · {tr('порог', 'threshold')} {sub.min_hotspot_count}
                          </p>
                          <p className="text-xs text-theme-muted">{tr('Центр', 'Center')}: {sub.center_lat}, {sub.center_lng}</p>
                          <button className="btn-secondary mt-2 !px-2 !py-1 text-xs" type="button" disabled={hotspotBusy} onClick={() => deleteHotspotSubscription(sub.id)}>
                            {tr('Удалить подписку', 'Delete subscription')}
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-theme-muted">{tr('Подписок пока нет. Используйте геопозицию и создайте первую подписку.', 'No subscriptions yet. Use geolocation and create your first subscription.')}</p>
                  )}
                  <form className="mt-4 rounded-2xl border border-border bg-surface-muted/70 p-3" onSubmit={saveHotspotPreferences}>
                    <p className="text-sm font-semibold text-theme">{tr('Каналы уведомлений hotspot', 'Hotspot notification channels')}</p>
                    <div className="mt-2 grid gap-2 md:grid-cols-3">
                      <label className="inline-flex items-center gap-2 text-sm text-theme">
                        <input
                          type="checkbox"
                          checked={hotspotPrefs.in_app_enabled}
                          onChange={(event) => setHotspotPrefs((prev) => ({ ...prev, in_app_enabled: event.target.checked }))}
                        />
                        In-app
                      </label>
                      <label className="inline-flex items-center gap-2 text-sm text-theme">
                        <input
                          type="checkbox"
                          checked={hotspotPrefs.email_enabled}
                          onChange={(event) => setHotspotPrefs((prev) => ({ ...prev, email_enabled: event.target.checked }))}
                        />
                        Email
                      </label>
                      <label className="inline-flex items-center gap-2 text-sm text-theme">
                        <input
                          type="checkbox"
                          checked={hotspotPrefs.sms_enabled}
                          onChange={(event) => setHotspotPrefs((prev) => ({ ...prev, sms_enabled: event.target.checked }))}
                        />
                        SMS
                      </label>
                    </div>
                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                      <label className="block">
                        <span className="label">Quiet hours start (UTC)</span>
                        <input
                          className="input"
                          type="number"
                          min={0}
                          max={23}
                          value={hotspotPrefs.quiet_hours_start}
                          onChange={(event) => setHotspotPrefs((prev) => ({ ...prev, quiet_hours_start: event.target.value }))}
                        />
                      </label>
                      <label className="block">
                        <span className="label">Quiet hours end (UTC)</span>
                        <input
                          className="input"
                          type="number"
                          min={0}
                          max={23}
                          value={hotspotPrefs.quiet_hours_end}
                          onChange={(event) => setHotspotPrefs((prev) => ({ ...prev, quiet_hours_end: event.target.value }))}
                        />
                      </label>
                    </div>
                    <button className="btn-secondary mt-3 w-full" type="submit" disabled={hotspotBusy}>
                      {hotspotBusy ? tr('Сохраняем каналы...', 'Saving channels...') : tr('Сохранить каналы и quiet hours', 'Save channels and quiet hours')}
                    </button>
                  </form>
                </>
              ) : (
                <p className="text-sm text-theme-muted">{tr('Войдите в личный кабинет, чтобы получать автоуведомления о горячих зонах.', 'Sign in to receive automatic hotspot alerts.')}</p>
              )}
            </Card>

            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-56 w-full" />
                <Skeleton className="h-56 w-full" />
              </div>
            ) : reports.length ? (
              <div className="grid gap-4 md:grid-cols-2">
                {reports.map((report) => (
                  <article
                    key={report.id}
                    className={`group rounded-3xl border p-3 shadow-card transition hover:-translate-y-0.5 hover:shadow-float ${
                      report.is_promoted
                        ? 'border-amber-300 bg-amber-50/50 dark:border-amber-700 dark:bg-amber-900/10'
                        : 'border-border bg-surface-muted/70'
                    }`}
                  >
                    <AppImage
                      src={resolvePetPhoto({ photo_url: report.photo_url, species: report.species, breed: report.breed })}
                      alt={report.pet_name}
                      width={880}
                      height={660}
                      sizes="(max-width: 768px) 100vw, 420px"
                      className="h-44 w-full rounded-2xl object-cover"
                    />
                    <div className="mt-3 space-y-1">
                      <p className="text-xl font-black text-theme">
                        {report.pet_name}
                        {report.is_promoted ? (
                          <span className="ml-2 rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800 dark:border-amber-700 dark:bg-amber-900/40 dark:text-amber-200">
                            {tr('Платное продвижение', 'Paid promotion')}
                          </span>
                        ) : null}
                      </p>
                      <p className="text-sm text-theme-muted">{report.species} · {report.breed || '—'}</p>
                      <p className="text-sm text-theme">{tr('Город', 'City')}: {report.city}</p>
                      <p className="text-sm text-theme">{tr('Последний раз', 'Last seen')}: {report.last_seen_location}</p>
                      {report.distance_km != null ? (
                        <p className="text-xs font-semibold text-sky-700 dark:text-sky-300">{tr('Рядом', 'Nearby')}: {report.distance_km} {tr('км', 'km')}</p>
                      ) : null}
                      <p className="text-xs text-theme-muted">{formatDate(report.last_seen_time)}</p>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button className="btn-primary" type="button" onClick={() => openReport(report.id)}>
                        {tr('Карточка', 'Details')}
                      </button>
                      <button className="btn-secondary" type="button" onClick={() => copyShareLink(report.id)}>
                        {tr('Поделиться', 'Share')}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState title={tr('Объявлений не найдено', 'No listings found')} text={tr('Попробуйте изменить город или обновить страницу позже.', 'Try changing the city or refreshing later.')} />
            )}
          </div>

          <aside className="space-y-4">
            {ownerMode ? (
              <Card title={tr('Сообщить о пропаже', 'Report a lost pet')} subtitle={tr('Форма владельца для публикации объявления', 'Owner form to publish a listing')}>
                <form className="space-y-3" onSubmit={submitLostReport}>
                  <label className="block">
                    <span className="label">{tr('Питомец', 'Pet')}</span>
                    <select
                      className="input"
                      value={lostForm.pet_id}
                      onChange={(event) => setLostForm((prev) => ({ ...prev, pet_id: event.target.value }))}
                    >
                      {pets.length ? (
                        pets.map((pet) => (
                          <option key={pet.id} value={pet.id}>
                            {pet.name} · {pet.species}
                          </option>
                        ))
                      ) : (
                        <option value="">{tr('Нет доступных питомцев', 'No available pets')}</option>
                      )}
                    </select>
                  </label>

                  <label className="block">
                    <span className="label">{tr('Город', 'City')}</span>
                    <input
                      className="input"
                      value={lostForm.city}
                      onChange={(event) => setLostForm((prev) => ({ ...prev, city: event.target.value }))}
                    />
                  </label>

                  <label className="block">
                    <span className="label">{tr('Последнее место', 'Last seen location')}</span>
                    <input
                      className="input"
                      value={lostForm.last_seen_location}
                      onChange={(event) => setLostForm((prev) => ({ ...prev, last_seen_location: event.target.value }))}
                      required
                    />
                  </label>

                  <label className="block">
                    <span className="label">{tr('Время', 'Time')}</span>
                    <input
                      className="input"
                      type="datetime-local"
                      value={lostForm.last_seen_time}
                      onChange={(event) => setLostForm((prev) => ({ ...prev, last_seen_time: event.target.value }))}
                      required
                    />
                  </label>

                  <label className="block">
                    <span className="label">{tr('Описание', 'Description')}</span>
                    <textarea
                      className="input min-h-[100px] resize-y"
                      value={lostForm.description}
                      onChange={(event) => setLostForm((prev) => ({ ...prev, description: event.target.value }))}
                      required
                    />
                  </label>
                  <button className="btn-secondary w-full" type="button" disabled={aiBusy} onClick={runAiEnhanceForOwnerForm}>
                    {aiBusy ? tr('ИИ анализирует...', 'AI is analyzing...') : tr('Улучшить описание через ИИ', 'Improve description with AI')}
                  </button>
                  {aiAssist ? (
                    <div className="rounded-xl border border-violet-300 bg-violet-50/60 px-3 py-2 text-xs text-violet-900 dark:border-violet-700 dark:bg-violet-900/20 dark:text-violet-100">
                      <p className="font-semibold">{tr('AI score полноты', 'AI completeness score')}: {aiAssist.completeness_score || 0}%</p>
                      {Array.isArray(aiAssist.missing_fields) && aiAssist.missing_fields.length ? (
                        <p className="mt-1">{tr('Не хватает полей', 'Missing fields')}: {aiAssist.missing_fields.join(', ')}</p>
                      ) : null}
                      {Array.isArray(aiAssist.checklist) && aiAssist.checklist.length ? (
                        <p className="mt-1">{tr('Подсказка', 'Hint')}: {aiAssist.checklist[0]}</p>
                      ) : null}
                    </div>
                  ) : null}

                  <label className="block">
                    <span className="label">{tr('Фото URL (опционально)', 'Photo URL (optional)')}</span>
                    <input
                      className="input"
                      value={lostForm.photo_url}
                      onChange={(event) => setLostForm((prev) => ({ ...prev, photo_url: event.target.value }))}
                      placeholder="https://..."
                    />
                  </label>
                  <label className="block">
                    <span className="label">{tr('Телефон для связи (опционально)', 'Contact phone (optional)')}</span>
                    <input
                      className="input"
                      value={lostForm.contact_phone}
                      onChange={(event) => setLostForm((prev) => ({ ...prev, contact_phone: event.target.value }))}
                      placeholder="+7..."
                    />
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm text-theme">
                    <input
                      type="checkbox"
                      checked={lostForm.allow_phone_public}
                      onChange={(event) => setLostForm((prev) => ({ ...prev, allow_phone_public: event.target.checked }))}
                    />
                    {tr('Публично показывать телефон в карточке объявления', 'Show phone publicly in listing card')}
                  </label>
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="block">
                      <span className="label">{tr('Широта (опционально)', 'Latitude (optional)')}</span>
                      <input
                        className="input"
                        type="number"
                        step="0.000001"
                        value={lostForm.last_seen_lat}
                        onChange={(event) => setLostForm((prev) => ({ ...prev, last_seen_lat: event.target.value }))}
                        placeholder="59.9311"
                      />
                    </label>
                    <label className="block">
                      <span className="label">{tr('Долгота (опционально)', 'Longitude (optional)')}</span>
                      <input
                        className="input"
                        type="number"
                        step="0.000001"
                        value={lostForm.last_seen_lng}
                        onChange={(event) => setLostForm((prev) => ({ ...prev, last_seen_lng: event.target.value }))}
                        placeholder="30.3609"
                      />
                    </label>
                  </div>

                  <button className="btn-primary w-full" disabled={saving} type="submit">
                    {saving ? tr('Публикуем...', 'Publishing...') : tr('Опубликовать объявление', 'Publish listing')}
                  </button>
                </form>
              </Card>
            ) : (
              <Card title={tr('Публикация для всех пользователей', 'Publishing for all users')} subtitle={tr('Self-service кабинет потеряшек', 'Self-service lost pets workspace')}>
                {loggedInMode ? (
                  <form className="space-y-3" onSubmit={submitSelfServiceLostReport}>
                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="block">
                        <span className="label">{tr('Кличка / имя питомца', 'Pet name')}</span>
                        <input
                          className="input"
                          value={selfServiceForm.pet_name}
                          onChange={(event) => setSelfServiceForm((prev) => ({ ...prev, pet_name: event.target.value }))}
                          required
                        />
                      </label>
                      <label className="block">
                        <span className="label">{tr('Вид', 'Species')}</span>
                        <input
                          className="input"
                          value={selfServiceForm.species}
                          onChange={(event) => setSelfServiceForm((prev) => ({ ...prev, species: event.target.value }))}
                          required
                        />
                      </label>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="block">
                        <span className="label">{tr('Порода', 'Breed')}</span>
                        <input
                          className="input"
                          value={selfServiceForm.breed}
                          onChange={(event) => setSelfServiceForm((prev) => ({ ...prev, breed: event.target.value }))}
                        />
                      </label>
                      <label className="block">
                        <span className="label">{tr('Окрас', 'Color')}</span>
                        <input
                          className="input"
                          value={selfServiceForm.color}
                          onChange={(event) => setSelfServiceForm((prev) => ({ ...prev, color: event.target.value }))}
                        />
                      </label>
                    </div>
                    <label className="block">
                      <span className="label">{tr('Город', 'City')}</span>
                      <input
                        className="input"
                        value={selfServiceForm.city}
                        onChange={(event) => setSelfServiceForm((prev) => ({ ...prev, city: event.target.value }))}
                      />
                    </label>
                    <label className="block">
                      <span className="label">{tr('Последнее место', 'Last seen location')}</span>
                      <input
                        className="input"
                        value={selfServiceForm.last_seen_location}
                        onChange={(event) => setSelfServiceForm((prev) => ({ ...prev, last_seen_location: event.target.value }))}
                        required
                      />
                    </label>
                    <label className="block">
                      <span className="label">{tr('Время', 'Time')}</span>
                      <input
                        className="input"
                        type="datetime-local"
                        value={selfServiceForm.last_seen_time}
                        onChange={(event) => setSelfServiceForm((prev) => ({ ...prev, last_seen_time: event.target.value }))}
                        required
                      />
                    </label>
                    <label className="block">
                      <span className="label">{tr('Подробное описание', 'Detailed description')}</span>
                      <textarea
                        className="input min-h-[100px] resize-y"
                        value={selfServiceForm.description}
                        onChange={(event) => setSelfServiceForm((prev) => ({ ...prev, description: event.target.value }))}
                        required
                      />
                    </label>
                    <button className="btn-secondary w-full" type="button" disabled={aiBusy} onClick={runAiEnhanceForSelfServiceForm}>
                      {aiBusy ? tr('ИИ анализирует...', 'AI is analyzing...') : tr('Улучшить описание через ИИ', 'Improve description with AI')}
                    </button>
                    {aiAssist ? (
                      <div className="rounded-xl border border-violet-300 bg-violet-50/60 px-3 py-2 text-xs text-violet-900 dark:border-violet-700 dark:bg-violet-900/20 dark:text-violet-100">
                        <p className="font-semibold">{tr('AI score полноты', 'AI completeness score')}: {aiAssist.completeness_score || 0}%</p>
                        {Array.isArray(aiAssist.missing_fields) && aiAssist.missing_fields.length ? (
                          <p className="mt-1">{tr('Не хватает полей', 'Missing fields')}: {aiAssist.missing_fields.join(', ')}</p>
                        ) : null}
                        {Array.isArray(aiAssist.checklist) && aiAssist.checklist.length ? (
                          <p className="mt-1">{tr('Подсказка', 'Hint')}: {aiAssist.checklist[0]}</p>
                        ) : null}
                      </div>
                    ) : null}
                    <label className="block">
                      <span className="label">{tr('Фото URL (опционально)', 'Photo URL (optional)')}</span>
                      <input
                        className="input"
                        value={selfServiceForm.photo_url}
                        onChange={(event) => setSelfServiceForm((prev) => ({ ...prev, photo_url: event.target.value }))}
                        placeholder="https://..."
                      />
                    </label>
                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="block">
                        <span className="label">{tr('Широта (опционально)', 'Latitude (optional)')}</span>
                        <input
                          className="input"
                          type="number"
                          step="0.000001"
                          value={selfServiceForm.last_seen_lat}
                          onChange={(event) => setSelfServiceForm((prev) => ({ ...prev, last_seen_lat: event.target.value }))}
                          placeholder="59.9311"
                        />
                      </label>
                      <label className="block">
                        <span className="label">{tr('Долгота (опционально)', 'Longitude (optional)')}</span>
                        <input
                          className="input"
                          type="number"
                          step="0.000001"
                          value={selfServiceForm.last_seen_lng}
                          onChange={(event) => setSelfServiceForm((prev) => ({ ...prev, last_seen_lng: event.target.value }))}
                          placeholder="30.3609"
                        />
                      </label>
                    </div>
                    <label className="block">
                      <span className="label">{tr('Телефон для связи', 'Contact phone')}</span>
                      <input
                        className="input"
                        value={selfServiceForm.contact_phone}
                        onChange={(event) => setSelfServiceForm((prev) => ({ ...prev, contact_phone: event.target.value }))}
                        placeholder="+7..."
                      />
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm text-theme">
                      <input
                        type="checkbox"
                        checked={selfServiceForm.allow_phone_public}
                        onChange={(event) => setSelfServiceForm((prev) => ({ ...prev, allow_phone_public: event.target.checked }))}
                      />
                      {tr('Показывать телефон публично', 'Show phone publicly')}
                    </label>
                    <button className="btn-primary w-full" disabled={saving} type="submit">
                      {saving ? tr('Публикуем...', 'Publishing...') : tr('Опубликовать как пользователь', 'Publish as user')}
                    </button>
                  </form>
                ) : (
                  <p className="text-sm text-theme">
                    Войдите в личный кабинет, чтобы опубликовать объявление в self-service режиме.
                  </p>
                )}
              </Card>
            )}

            {ownerMode ? (
              <Card title="Мои объявления" subtitle="Быстро откройте карточку или закройте кейс как найденный">
                {ownerReports.length ? (
                  <div className="space-y-2">
                    {ownerReports.slice(0, 8).map((row) => (
                      <div key={row.id} className="rounded-xl border border-border bg-surface-muted/70 px-3 py-2 text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <button
                            type="button"
                            className="text-left font-semibold text-text hover:underline"
                            onClick={() => openReport(row.id)}
                          >
                            {row.pet_name}
                          </button>
                          <span className={`pill ${row.status === 'found' ? 'status-tone-success !rounded-full' : ''}`}>
                            {row.status === 'found' ? 'Найден' : 'Активно'}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-theme-muted">{row.city} · {formatDate(row.last_seen_time)}</p>
                        {row.status === 'active' ? (
                          <button
                            type="button"
                            className="mt-2 btn-secondary !px-2 !py-1 text-xs"
                            disabled={saving}
                            onClick={() => markFound(row.id)}
                          >
                            Отметить найденным
                          </button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState title="Пока нет объявлений" text="После публикации они появятся в этом блоке." />
                )}
              </Card>
            ) : null}

            <Card title={tr('Карточка объявления', 'Listing details')} subtitle={tr('Контакт с владельцем через безопасное сообщение', 'Contact the owner through secure messaging')}>
              {loadingDetail ? (
                <div className="space-y-2">
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                </div>
              ) : selectedReport ? (
                <>
                  <div className="rounded-2xl border border-border bg-surface-muted/65 px-3 py-2 text-sm text-theme">
                    <p className="font-semibold text-theme">{selectedReport.pet_name}</p>
                    <p>{selectedReport.description}</p>
                    <p className="mt-1 text-xs text-theme-muted">{tr('Статус', 'Status')}: {selectedReport.status || 'active'}</p>
                    {selectedReport.is_promoted ? (
                      <p className="mt-1 text-xs font-semibold text-amber-700 dark:text-amber-300">
                        {tr('Продвижение активно до', 'Promotion active until')} {formatDate(selectedReport.promoted_until, locale)}
                      </p>
                    ) : null}
                    {selectedReport.contact_phone ? (
                      <p className="mt-1 text-xs text-theme-muted">{tr('Телефон', 'Phone')}: {selectedReport.contact_phone}</p>
                    ) : null}
                  </div>

                  {ownerMode ? (
                    <div className="mt-3 rounded-2xl border border-amber-300 bg-amber-50/60 p-3 dark:border-amber-700 dark:bg-amber-900/15">
                      <p className="text-sm font-black uppercase tracking-wide text-amber-800 dark:text-amber-200">{tr('Платное продвижение', 'Paid promotion')}</p>
                      <p className="mt-1 text-xs text-amber-900/90 dark:text-amber-100/90">
                        {tr('Платные объявления выделяются цветом и поднимаются выше в ленте. Услуга маркируется как рекламная.', 'Paid listings are color-highlighted and ranked higher in the feed. The service is marked as advertising.')}
                      </p>
                      <div className="mt-3 grid gap-2 md:grid-cols-2">
                        <label className="block">
                          <span className="label">{tr('Тариф', 'Plan')}</span>
                          <select
                            className="input"
                            value={promoForm.tier}
                            onChange={(event) => setPromoForm((prev) => ({ ...prev, tier: event.target.value }))}
                          >
                            <option value="boost">{tr('Boost (49 ₽ / день)', 'Boost (49 RUB / day)')}</option>
                            <option value="premium">{tr('Premium (89 ₽ / день)', 'Premium (89 RUB / day)')}</option>
                          </select>
                        </label>
                        <label className="block">
                          <span className="label">{tr('Дней', 'Days')}</span>
                          <input
                            className="input"
                            type="number"
                            min={1}
                            max={30}
                            value={promoForm.duration_days}
                            onChange={(event) => setPromoForm((prev) => ({ ...prev, duration_days: Number(event.target.value || 7) }))}
                          />
                        </label>
                      </div>
                      <label className="mt-2 block">
                        <span className="label">{tr('Идемпотентность платежа', 'Payment idempotency key')}</span>
                        <input
                          className="input"
                          value={promoForm.idempotency_key}
                          onChange={(event) => setPromoForm((prev) => ({ ...prev, idempotency_key: event.target.value }))}
                        />
                      </label>
                      <button className="btn-primary mt-3 w-full" type="button" disabled={promoBusy} onClick={startPromotionCheckout}>
                        {promoBusy ? tr('Создаем checkout...', 'Creating checkout...') : tr('Создать оплату продвижения', 'Create promotion payment')}
                      </button>

                      {promoCheckout ? (
                        <div className="mt-3 rounded-xl border border-border bg-surface/80 p-2 text-xs text-theme">
                          <p>{tr('Платеж', 'Payment')}: {promoCheckout.id}</p>
                          <p>{tr('Сумма', 'Amount')}: {(promoCheckout.amount_cents / 100).toFixed(2)} {promoCheckout.currency}</p>
                          <p>{tr('Статус', 'Status')}: {promoCheckout.status}</p>
                          <div className="mt-2 grid grid-cols-2 gap-2">
                            <button className="btn-secondary !px-2 !py-1 text-xs" type="button" disabled={promoBusy} onClick={() => confirmPromotionPayment('succeeded')}>
                              {tr('Подтвердить успех', 'Confirm success')}
                            </button>
                            <button className="btn-secondary !px-2 !py-1 text-xs" type="button" disabled={promoBusy} onClick={() => confirmPromotionPayment('failed')}>
                              {tr('Смоделировать ошибку', 'Simulate failure')}
                            </button>
                          </div>
                        </div>
                      ) : null}

                      {promoPayments.length ? (
                        <div className="mt-2 max-h-36 space-y-1 overflow-auto text-xs">
                          {promoPayments.slice(0, 6).map((row) => (
                            <div key={row.id} className="rounded-lg border border-border bg-surface/85 px-2 py-1">
                              {row.tier} · {row.duration_days} {tr('дн', 'days')} · {(row.amount_cents / 100).toFixed(2)} {tr('₽', 'RUB')} · {row.status}
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="mt-3 rounded-2xl border border-sky-300 bg-sky-50/60 p-3 dark:border-sky-700 dark:bg-sky-900/15">
                    <p className="text-sm font-black uppercase tracking-wide text-sky-800 dark:text-sky-200">{tr('Ближайшие ветклиники', 'Nearby vet clinics')}</p>
                    <p className="mt-1 text-xs text-sky-900/90 dark:text-sky-100/90">
                      {tr('Подбор клиник по геоточке объявления. Владелец может массово уведомить клиники рядом.', 'Clinics are selected by listing geolocation. Owners can notify nearby clinics in bulk.')}
                    </p>
                    <div className="mt-2 flex flex-wrap items-end gap-2">
                      <label className="block">
                        <span className="label">{tr('Радиус, км', 'Radius, km')}</span>
                        <input
                          className="input"
                          type="number"
                          min={1}
                          max={300}
                          value={clinicNotifyRadius}
                          onChange={(event) => setClinicNotifyRadius(Number(event.target.value || 25))}
                        />
                      </label>
                      <button
                        className="btn-secondary"
                        type="button"
                        disabled={nearbyClinicsLoading || !selectedReport?.id}
                        onClick={() => openReport(selectedReport.id)}
                      >
                        {nearbyClinicsLoading ? tr('Ищем клиники...', 'Searching clinics...') : tr('Обновить список клиник', 'Refresh clinic list')}
                      </button>
                      {ownerMode ? (
                        <button className="btn-primary" type="button" disabled={clinicNotifyBusy} onClick={notifyNearbyClinics}>
                          {clinicNotifyBusy ? tr('Отправляем уведомления...', 'Sending notifications...') : tr('Уведомить клиники рядом', 'Notify nearby clinics')}
                        </button>
                      ) : null}
                    </div>
                    {nearbyClinics.length ? (
                      <div className="mt-2 max-h-40 space-y-1 overflow-auto text-xs">
                        {nearbyClinics.slice(0, 10).map((clinic) => (
                          <div key={clinic.clinic_id} className="rounded-lg border border-border bg-surface/85 px-2 py-1">
                            <div className="font-semibold text-theme">{clinic.clinic_name}</div>
                            <div className="text-theme-muted">{clinic.city || '—'} · {clinic.address || '—'} · {clinic.distance_km} {tr('км', 'km')}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-theme-muted">{tr('Клиники в радиусе не найдены или не заданы координаты объявления.', 'No clinics found in radius or listing coordinates are missing.')}</p>
                    )}
                  </div>

                  <div className="mt-3 rounded-2xl border border-violet-300 bg-violet-50/60 p-3 dark:border-violet-700 dark:bg-violet-900/15">
                    <p className="text-sm font-black uppercase tracking-wide text-violet-800 dark:text-violet-200">{tr('Чат по объявлению', 'Listing chat')}</p>
                    <p className="mt-1 text-xs text-violet-900/90 dark:text-violet-100/90">
                      {tr('Полноценная переписка owner ↔ откликнувшиеся пользователи с историей сообщений и статусом прочтения.', 'Full owner ↔ responders conversation with message history and read status.')}
                    </p>
                    {!session?.accessToken ? (
                      <p className="mt-2 text-xs text-theme-muted">{tr('Для переписки войдите в личный кабинет.', 'Sign in to use chat.')}</p>
                    ) : (
                      <>
                        {ownerMode ? (
                          <label className="mt-2 block">
                            <span className="label">{tr('Получатель (тред)', 'Recipient (thread)')}</span>
                            <select
                              className="input"
                              value={chatRecipientId}
                              onChange={(event) => setChatRecipientId(event.target.value)}
                            >
                              <option value="">{tr('Выберите участника', 'Select participant')}</option>
                              {chatThreads.map((thread) => (
                                <option key={thread.participant_user_id} value={thread.participant_user_id}>
                                  {thread.participant_label || thread.participant_user_id} · {tr('непрочитано', 'unread')}: {thread.unread_count || 0}
                                </option>
                              ))}
                            </select>
                          </label>
                        ) : null}
                        <div className="mt-2 max-h-48 space-y-1 overflow-auto rounded-xl border border-border bg-surface/80 p-2 text-xs">
                          {chatMessages.length ? (
                            chatMessages.map((message) => (
                              <div
                                key={message.id}
                                className={`rounded-lg px-2 py-1 ${
                                  message.direction === 'outgoing'
                                    ? 'bg-violet-100 text-violet-900 dark:bg-violet-900/40 dark:text-violet-100'
                                    : 'bg-surface-muted text-theme'
                                }`}
                              >
                                <div className="font-semibold">
                                  {message.sender_label || message.sender_user_id} · {message.direction === 'outgoing' ? tr('вы', 'you') : tr('входящее', 'incoming')}
                                </div>
                                <div>{message.body}</div>
                              </div>
                            ))
                          ) : (
                            <p className="text-theme-muted">{tr('Пока нет сообщений.', 'No messages yet.')}</p>
                          )}
                        </div>
                        <form className="mt-2 space-y-2" onSubmit={sendChatMessage}>
                          <textarea
                            className="input min-h-[88px] resize-y"
                            value={chatForm.message}
                            onChange={(event) => setChatForm({ message: event.target.value })}
                            placeholder={tr('Напишите сообщение...', 'Write a message...')}
                            required
                          />
                          <button className="btn-primary w-full" type="submit" disabled={chatBusy || (ownerMode && !chatRecipientId && chatThreads.length > 0)}>
                            {chatBusy ? tr('Отправка...', 'Sending...') : tr('Отправить в чат', 'Send to chat')}
                          </button>
                        </form>
                      </>
                    )}
                  </div>

                  <div className="mt-3 rounded-2xl border border-rose-300 bg-rose-50/60 p-3 dark:border-rose-700 dark:bg-rose-900/15">
                    <p className="text-sm font-black uppercase tracking-wide text-rose-800 dark:text-rose-200">{tr('Антифрод и жалобы', 'Anti-fraud and reports')}</p>
                    <p className="mt-1 text-xs text-rose-900/90 dark:text-rose-100/90">
                      {tr('Если объявление выглядит подозрительно, отправьте жалобу. При множественных жалобах карточка уходит в модерацию.', 'If a listing looks suspicious, report it. Multiple reports move it to moderation.')}
                    </p>
                    <form className="mt-2 space-y-2" onSubmit={submitAbuseReport}>
                      <label className="block">
                        <span className="label">{tr('Причина', 'Reason')}</span>
                        <select
                          className="input"
                          value={abuseForm.reason}
                          onChange={(event) => setAbuseForm((prev) => ({ ...prev, reason: event.target.value }))}
                        >
                          <option value="spam">{tr('Спам/реклама не по теме', 'Spam/off-topic advertising')}</option>
                          <option value="fraud">{tr('Подозрение на мошенничество', 'Fraud suspicion')}</option>
                          <option value="illegal">{tr('Нарушение правил/незаконный контент', 'Policy violation/illegal content')}</option>
                          <option value="duplicate">{tr('Дубликат/ложное объявление', 'Duplicate/false listing')}</option>
                        </select>
                      </label>
                      <textarea
                        className="input min-h-[72px] resize-y"
                        value={abuseForm.message}
                        onChange={(event) => setAbuseForm((prev) => ({ ...prev, message: event.target.value }))}
                        placeholder={tr('Комментарий для модерации (опционально)', 'Moderation comment (optional)')}
                      />
                      <button className="btn-secondary w-full" type="submit" disabled={abuseBusy}>
                        {abuseBusy ? tr('Отправляем жалобу...', 'Sending report...') : tr('Пожаловаться на объявление', 'Report listing')}
                      </button>
                    </form>
                  </div>

                  {ownerMode && selectedReport.status === 'active' ? (
                    <button
                      className="btn-secondary mt-3 w-full"
                      type="button"
                      disabled={saving}
                      onClick={() => markFound(selectedReport.id)}
                    >
                      {tr('Отметить как найден', 'Mark as found')}
                    </button>
                  ) : null}

                  <form className="mt-3 space-y-2" onSubmit={submitSighting}>
                    <input
                      className="input"
                      value={sightingForm.reporter_name}
                      onChange={(event) => setSightingForm((prev) => ({ ...prev, reporter_name: event.target.value }))}
                      placeholder={tr('Ваше имя', 'Your name')}
                    />
                    <input
                      className="input"
                      value={sightingForm.reporter_contact}
                      onChange={(event) => setSightingForm((prev) => ({ ...prev, reporter_contact: event.target.value }))}
                      placeholder={tr('Телефон/email для обратной связи', 'Phone/email for reply')}
                    />
                    <input
                      className="input"
                      value={sightingForm.location_note}
                      onChange={(event) => setSightingForm((prev) => ({ ...prev, location_note: event.target.value }))}
                      placeholder={tr('Где видели питомца', 'Where you saw the pet')}
                    />
                    <textarea
                      className="input min-h-[88px] resize-y"
                      value={sightingForm.message}
                      onChange={(event) => setSightingForm((prev) => ({ ...prev, message: event.target.value }))}
                      placeholder={tr('Сообщение владельцу', 'Message to owner')}
                      required
                    />
                    <button className="btn-primary w-full" type="submit" disabled={saving}>
                      {saving ? tr('Отправляем...', 'Sending...') : tr('Отправить владельцу', 'Send to owner')}
                    </button>
                  </form>

                  {selectedReport.sightings?.length ? (
                    <div className="mt-3 space-y-2">
                      {selectedReport.sightings.slice(0, 4).map((item) => (
                        <div key={item.id} className="rounded-xl border border-border bg-surface-muted/70 px-3 py-2 text-xs text-theme">
                          <p className="font-semibold">{item.reporter_name || tr('Аноним', 'Anonymous')}</p>
                          {ownerMode ? (
                            <>
                              <p>{item.message || tr('Сообщение скрыто', 'Message hidden')}</p>
                              {item.reporter_contact_masked ? (
                                <p className="mt-1 text-[11px] text-theme-muted">{tr('Контакт (privacy-safe)', 'Contact (privacy-safe)')}: {item.reporter_contact_masked}</p>
                              ) : null}
                            </>
                          ) : (
                            <p className="text-theme-muted">{tr('Публичный сигнал получен. Полный текст виден только владельцу.', 'Public signal received. Full text is visible to owner only.')}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </>
              ) : (
                <EmptyState title={tr('Выберите объявление', 'Select a listing')} text={tr('Откройте карточку питомца, чтобы отправить сообщение владельцу.', 'Open a pet listing to send a message to the owner.')} />
              )}
            </Card>
          </aside>
        </section>
      </section>
    </main>
  );
}
