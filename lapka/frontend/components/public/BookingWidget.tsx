"use client";

import { useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function BookingWidget({ clinicId }: { clinicId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [services, setServices] = useState<any[]>([]);
  const [slots, setSlots] = useState<any[]>([]);
  const [selectedService, setSelectedService] = useState<any>(null);
  const [selectedSlot, setSelectedSlot] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<any>(null);
  const [owner, setOwner] = useState({ full_name: "", email: "", phone: "" });
  const [pet, setPet] = useState({ name: "", species: "dog" });

  const loadServices = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/v1/public/booking/${clinicId}/services`);
      setServices(await res.json());
      setStep(2);
    } catch { setError("Ошибка"); } finally { setLoading(false); }
  };

  const loadSlots = async (date: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/v1/public/booking/${clinicId}/slots?target_date=${date}`);
      setSlots(await res.json());
      setStep(3);
    } catch { setError("Ошибка"); } finally { setLoading(false); }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/v1/public/booking/${clinicId}/book`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner, pet, service_id: selectedService?.id, start_at: selectedSlot?.start_at }),
      });
      if (!res.ok) throw new Error();
      setSuccess(await res.json());
      setStep(4);
    } catch { setError("Ошибка бронирования"); } finally { setLoading(false); }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 bg-blue-600 text-white px-6 py-3 rounded-full shadow-lg hover:bg-blue-700 z-50"
      >
        📅 Записаться
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 w-96 bg-white rounded-xl shadow-2xl z-50 overflow-hidden">
      <div className="bg-blue-600 text-white p-4 flex justify-between items-center">
        <h3 className="font-bold">Онлайн-запись</h3>
        <button onClick={() => setIsOpen(false)} className="text-white hover:text-gray-200">✕</button>
      </div>

      <div className="p-4 max-h-96 overflow-y-auto">
        {step === 1 && (
          <button onClick={loadServices} disabled={loading} className="w-full bg-blue-600 text-white py-2 rounded">
            {loading ? "Загрузка..." : "Выбрать услугу"}
          </button>
        )}

        {step === 2 && (
          <div className="space-y-2">
            {services.map(s => (
              <button key={s.id} onClick={() => { setSelectedService(s); loadSlots(new Date().toISOString().split("T")[0]); }} 
                className="w-full text-left p-2 border rounded hover:bg-blue-50">
                <div className="font-medium">{s.name}</div>
                <div className="text-sm text-gray-500">{s.price}₽ · {s.duration_minutes}мин</div>
              </button>
            ))}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <input type="date" onChange={e => loadSlots(e.target.value)} className="w-full p-2 border rounded" />
            <div className="grid grid-cols-3 gap-1">
              {slots.slice(0, 15).map((s, i) => (
                <button key={i} onClick={() => { setSelectedSlot(s); setStep(3.5); }}
                  className="p-1 text-xs border rounded hover:bg-blue-50">
                  {new Date(s.start_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 3.5 && (
          <div className="space-y-2">
            <input placeholder="ФИО" value={owner.full_name} onChange={e => setOwner({...owner, full_name: e.target.value})} className="w-full p-2 border rounded text-sm" />
            <input placeholder="Email" value={owner.email} onChange={e => setOwner({...owner, email: e.target.value})} className="w-full p-2 border rounded text-sm" />
            <input placeholder="Телефон" value={owner.phone} onChange={e => setOwner({...owner, phone: e.target.value})} className="w-full p-2 border rounded text-sm" />
            <input placeholder="Питомец" value={pet.name} onChange={e => setPet({...pet, name: e.target.value})} className="w-full p-2 border rounded text-sm" />
            <button onClick={handleSubmit} disabled={loading} className="w-full bg-green-600 text-white py-2 rounded">
              {loading ? "..." : "Записаться"}
            </button>
          </div>
        )}

        {step === 4 && success && (
          <div className="text-center py-4">
            <div className="text-green-600 font-bold text-lg mb-2">✓ Запись подтверждена!</div>
            <div className="text-sm text-gray-600">{success.service_name} к {success.vet_name}</div>
            <div className="text-sm text-gray-500">{new Date(success.start_at).toLocaleString("ru-RU")}</div>
          </div>
        )}
      </div>
    </div>
  );
}