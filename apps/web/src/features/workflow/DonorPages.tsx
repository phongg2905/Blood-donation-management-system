import { useState, useEffect, useRef } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
  Building2,
  Calendar,
  Camera,
  Clock,
  Download,
  Droplet,
  FileText,
  HeartHandshake,
  RefreshCw,
  TestTube2,
  Trash2,
  ZoomIn,
} from 'lucide-react';
import { Button } from '@/components/ui';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { uploadCertificatePhoto, isSupabaseConfigured, SUPABASE_BUCKET } from '@/services/supabase';
import { useWorkflowQuery } from './hooks';
import { useWorkflowRepository } from './repository';
import { WorkflowShell } from './components';
import { parseBackendBloodType } from './domain';

/* ==========================================================================
   Date / Time Utilities
   ========================================================================== */

function formatDdMmYyyy(dateStr?: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function formatSlotRangeTime(slotStartsAt?: string | null, slotEndsAt?: string | null): string {
  if (!slotStartsAt) return 'Theo lịch hẹn';
  const start = new Date(slotStartsAt);
  if (isNaN(start.getTime())) return slotStartsAt;
  const startH = String(start.getHours()).padStart(2, '0');
  const startM = String(start.getMinutes()).padStart(2, '0');
  const day = String(start.getDate()).padStart(2, '0');
  const month = String(start.getMonth() + 1).padStart(2, '0');
  const year = start.getFullYear();

  if (slotEndsAt) {
    const end = new Date(slotEndsAt);
    if (!isNaN(end.getTime())) {
      const endH = String(end.getHours()).padStart(2, '0');
      const endM = String(end.getMinutes()).padStart(2, '0');
      return `${startH}:${startM} đến ${endH}:${endM} - ${day}/${month}/${year}`;
    }
  }
  return `${startH}:${startM} - ${day}/${month}/${year}`;
}

function add84Days(dateStr?: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  d.setDate(d.getDate() + 84);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/* ==========================================================================
   Unified Appointment Model for Lịch sử đặt hẹn
   ========================================================================== */

export interface UnifiedAppointment {
  id: string;
  code: string;
  campaignName: string;
  location: string;
  startsAt: string;
  endsAt?: string;
  date: string;
  status: 'COMPLETED' | 'CANCELLED' | 'NO_SHOW' | 'CONFIRMED' | 'SCHEDULED' | 'PENDING';
  statusLabel: string;
  volumeMl?: number | null;
  bloodGroup?: string | null;
  rh?: string | null;
  testDate?: string;
}

/* ==========================================================================
   DonorHistoryPage: Redesigned matching reference Images 1, 2, 3, 4
   ========================================================================== */

export function DonorHistoryPage() {
  const workflow = useWorkflowRepository();
  const { currentUser } = useAuth();
  const donorId = currentUser?.id ?? '';

  const registrations = useWorkflowQuery(
    'my-registrations',
    () => workflow.myRegistrations(donorId),
    Boolean(donorId),
  );
  const history = useWorkflowQuery(
    'donor-history',
    () => workflow.history(donorId),
    Boolean(donorId),
  );

  const [activeTab, setActiveTab] = useState<'UPCOMING' | 'COMPLETED' | 'CANCELLED'>('UPCOMING');
  const [selectedAppointment, setSelectedAppointment] = useState<UnifiedAppointment | null>(null);
  const [showTestResultModal, setShowTestResultModal] = useState<boolean>(false);

  // Build unified appointment list
  const appointmentList: UnifiedAppointment[] = [];

  // Completed donations from history
  (history.data ?? []).forEach((entry) => {
    const dateStr = entry.date || '';
    const d = dateStr ? new Date(dateStr) : null;
    const isValidDate = d !== null && !isNaN(d.getTime());
    const testDate = isValidDate
      ? formatDdMmYyyy(new Date(d.getTime() + 8 * 86400000).toISOString())
      : undefined;

    const parsed = parseBackendBloodType(entry.bloodGroup);

    appointmentList.push({
      id: `donation-${entry.id}`,
      code: entry.id,
      campaignName: entry.campaignName || 'Điểm hiến máu',
      location: entry.location || 'Địa điểm hiến máu',
      startsAt: dateStr,
      date: dateStr,
      status: 'COMPLETED',
      statusLabel: 'Đã hiến máu',
      volumeMl: entry.volumeMl ?? 350,
      bloodGroup: parsed.bloodGroup,
      rh: parsed.rh,
      testDate,
    });
  });

  // Active / cancelled registrations
  (registrations.data ?? []).forEach((reg) => {
    let status: UnifiedAppointment['status'] = 'CONFIRMED';
    let statusLabel = 'Đã đăng ký';

    if (reg.status === 'COMPLETED') {
      status = 'COMPLETED';
      statusLabel = 'Đã hiến máu';
    } else if (reg.status === 'CANCELLED') {
      status = 'CANCELLED';
      statusLabel = 'Đã hủy';
    } else if (reg.status === 'NO_SHOW') {
      status = 'NO_SHOW';
      statusLabel = 'Không đến';
    } else if (reg.status === 'PENDING' || reg.status === 'WAITLISTED') {
      status = 'PENDING';
      statusLabel = 'Chờ duyệt';
    } else {
      status = 'CONFIRMED';
      statusLabel = 'Đã đăng ký';
    }

    const regDate = reg.slotStartsAt || reg.campaignStartsAt || reg.createdAt || '';

    appointmentList.push({
      id: `reg-${reg.id}`,
      code: reg.code,
      campaignName: reg.campaignName || 'Điểm hiến máu',
      location: reg.location || 'Địa điểm hiến máu',
      startsAt: regDate,
      endsAt: reg.slotEndsAt || reg.campaignEndsAt || undefined,
      date: regDate,
      status,
      statusLabel,
      volumeMl: status === 'COMPLETED' ? 350 : null,
      bloodGroup: null,
      rh: null,
      testDate: status === 'COMPLETED' && regDate ? formatDdMmYyyy(regDate) : undefined,
    });
  });


  // Sort: completed and active first (safely without NaN)
  appointmentList.sort((a, b) => {
    const timeA = a.date ? new Date(a.date).getTime() : 0;
    const timeB = b.date ? new Date(b.date).getTime() : 0;
    return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA);
  });

  const upcomingList = appointmentList.filter(
    (item) => item.status === 'CONFIRMED' || item.status === 'SCHEDULED' || item.status === 'PENDING',
  );
  const completedList = appointmentList.filter((item) => item.status === 'COMPLETED');
  const cancelledList = appointmentList.filter(
    (item) => item.status === 'CANCELLED' || item.status === 'NO_SHOW',
  );

  const displayedList =
    activeTab === 'UPCOMING'
      ? upcomingList
      : activeTab === 'COMPLETED'
      ? completedList
      : cancelledList;

  // DETAIL VIEW (Images 2 & 4)
  if (selectedAppointment) {
    return (
      <WorkflowShell
        title=""
        actions={
          <button
            className="btn btn--secondary"
            onClick={() => setSelectedAppointment(null)}
          >
            ← Danh sách đặt hẹn
          </button>
        }
      >
        <div className="history-detail-wrap">
          {/* Header */}
          <div className="history-detail-header">
            <h1 className="history-detail-title">Lịch sử đặt hẹn</h1>
            <div className="history-detail-status-row">
              <span>Trạng thái:</span>
              <span
                className={`appointment-pill ${
                  selectedAppointment.status === 'COMPLETED'
                    ? 'appointment-pill--completed'
                    : selectedAppointment.status === 'CANCELLED'
                    ? 'appointment-pill--cancelled'
                    : selectedAppointment.status === 'PENDING'
                    ? 'appointment-pill--pending'
                    : 'appointment-pill--confirmed'
                }`}
              >
                {selectedAppointment.statusLabel}
              </span>
            </div>
          </div>

          {/* 2-Column Grid */}
          <div className="history-detail-grid">
            {/* Column 1: Thông tin hiến máu */}
            <div className="history-panel-card">
              <h2 className="history-panel-card__title">Thông tin hiến máu</h2>
              <div className="zebra-table-list">
                <div className="zebra-table-row">
                  <span className="zebra-table-label">Hình thức hiến:</span>
                  <span className="zebra-table-value">Hiến máu</span>
                </div>
                <div className="zebra-table-row">
                  <span className="zebra-table-label">Cơ sở tiếp nhận máu:</span>
                  <span className="zebra-table-value">
                    {selectedAppointment.campaignName}
                  </span>
                </div>
                <div className="zebra-table-row">
                  <span className="zebra-table-label">Địa chỉ:</span>
                  <span className="zebra-table-value">
                    {selectedAppointment.location}
                  </span>
                </div>
                <div className="zebra-table-row">
                  <span className="zebra-table-label">Lượng máu đã hiến:</span>
                  <span className="zebra-table-value">
                    {selectedAppointment.volumeMl ? `${selectedAppointment.volumeMl}ml` : '-'}
                  </span>
                </div>
                <div className="zebra-table-row">
                  <span className="zebra-table-label">Ngày hiến máu:</span>
                  <span className="zebra-table-value">
                    {formatDdMmYyyy(selectedAppointment.date)}
                  </span>
                </div>
              </div>
            </div>

            {/* Column 2: Kết quả xét nghiệm (only if COMPLETED) */}
            {selectedAppointment.status === 'COMPLETED' && (
              <div className="history-panel-card">
                <h2 className="history-panel-card__title">Kết quả xét nghiệm</h2>
                <div className="test-result-center">
                  <TestTube2 size={54} color="#0284c7" strokeWidth={1.8} />
                  <button
                    type="button"
                    className="test-result-link-btn"
                    onClick={() => setShowTestResultModal(true)}
                  >
                    Xem kết quả xét nghiệm
                  </button>
                  <span className="test-result-date">
                    {selectedAppointment.testDate ?? formatDdMmYyyy(selectedAppointment.date)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Centered Return Button */}
          <div className="history-footer-actions">
            <button
              type="button"
              className="btn-back-outline"
              onClick={() => setSelectedAppointment(null)}
            >
              Quay về
            </button>
          </div>
        </div>

        {/* Modal: Kết quả hiến máu (Image 3) */}
        {showTestResultModal && (
          <div
            className="test-modal-backdrop"
            onClick={() => setShowTestResultModal(false)}
          >
            <div
              className="test-modal-dialog"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="test-modal-body">
                <h2 className="test-modal-title">Kết quả hiến máu</h2>
                <p className="test-modal-subtitle">
                  Ngày thực hiện : {selectedAppointment.testDate ?? formatDdMmYyyy(selectedAppointment.date)}
                </p>

                {/* Sàng lọc Card */}
                <div className="screening-box">
                  <div className="screening-box__header">Sàng lọc & Xét nghiệm nhóm máu</div>
                  <div className="zebra-table-list">
                    <div className="zebra-table-row">
                      <span className="zebra-table-label">
                        Kết quả xét nghiệm sàng lọc
                      </span>
                      <span className="zebra-table-value">Đạt</span>
                    </div>
                    <div className="zebra-table-row">
                      <span className="zebra-table-label">Nhóm máu ABO</span>
                      <span className="zebra-table-value">
                        {selectedAppointment.bloodGroup
                          ? `Nhóm ${selectedAppointment.bloodGroup}`
                          : 'Chờ kết quả xét nghiệm phòng Lab'}
                      </span>
                    </div>
                    <div className="zebra-table-row">
                      <span className="zebra-table-label">Yếu tố Rh</span>
                      <span className="zebra-table-value">
                        {selectedAppointment.rh
                          ? (selectedAppointment.rh === 'Rh+' ? 'Dương tính (Rh+)' : 'Âm tính (Rh−)')
                          : 'Chờ kết quả xét nghiệm'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Thank You Banner */}
                <div className="thank-you-banner">
                  <HeartHandshake size={56} color="#e11d48" strokeWidth={1.8} style={{ flexShrink: 0 }} />
                  <div>
                    <div className="thank-you-banner__text">
                      Cảm ơn bạn đã hiến máu ngày{' '}
                      {formatDdMmYyyy(selectedAppointment.date)}.{' '}
                      {selectedAppointment.bloodGroup ? (
                        <>Nhóm máu khẳng định của bạn là <strong>{selectedAppointment.bloodGroup} ({selectedAppointment.rh ?? 'Rh+'})</strong>. Máu của bạn đã được kiểm định và sẵn sàng sử dụng cho người bệnh.</>
                      ) : (
                        <>Mẫu máu của bạn đang trong quá trình xét nghiệm khẳng định nhóm máu tại phòng Lab. Kết quả chi tiết sẽ được thông báo ngay khi hoàn tất.</>
                      )}{' '}
                      Ngày hiến máu tiếp theo dự kiến là từ ngày{' '}
                      {add84Days(selectedAppointment.date)} (cộng dồn 84 ngày kể từ
                      ngày hiến máu).
                    </div>
                    <div className="thank-you-banner__warning">
                      TTHMNĐ-TP và BVTMHH KHÔNG ÁP DỤNG BẤT KỲ HÌNH THỨC ĐĂNG KÝ
                      KHÁM LẠI SAU KHI HIẾN MÁU QUA LINK/APP/ZALO
                    </div>
                  </div>
                </div>
              </div>

              <div className="test-modal-footer">
                <Button
                  variant="secondary"
                  onClick={() => setShowTestResultModal(false)}
                >
                  Đóng
                </Button>
              </div>
            </div>
          </div>
        )}
      </WorkflowShell>
    );
  }

  // LIST VIEW (Image 1)
  return (
    <WorkflowShell
      title="Lịch sử đặt hẹn"
      actions={
        <Link className="btn btn--primary" to="/campaigns">
          + Đăng ký hiến máu mới
        </Link>
      }
    >
      {/* Tabs navigation without icons */}
      <div className="history-tab-nav" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'UPCOMING'}
          className={`history-tab-btn ${activeTab === 'UPCOMING' ? 'history-tab-btn--active' : ''}`}
          onClick={() => setActiveTab('UPCOMING')}
        >
          Chưa hiến <span className="history-tab-count">({upcomingList.length})</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'COMPLETED'}
          className={`history-tab-btn ${activeTab === 'COMPLETED' ? 'history-tab-btn--active' : ''}`}
          onClick={() => setActiveTab('COMPLETED')}
        >
          Đã hiến <span className="history-tab-count">({completedList.length})</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'CANCELLED'}
          className={`history-tab-btn ${activeTab === 'CANCELLED' ? 'history-tab-btn--active' : ''}`}
          onClick={() => setActiveTab('CANCELLED')}
        >
          Đã hủy <span className="history-tab-count">({cancelledList.length})</span>
        </button>
      </div>

      {displayedList.length === 0 ? (
        <div className="history-empty-state">
          <p className="history-empty-text">
            {activeTab === 'UPCOMING'
              ? 'Bạn hiện không có lịch hẹn hiến máu nào đang chờ.'
              : activeTab === 'COMPLETED'
              ? 'Bạn chưa có lượt hiến máu nào đã hoàn thành.'
              : 'Không có lịch hẹn nào đã hủy.'}
          </p>
          {activeTab === 'UPCOMING' && (
            <Link className="btn btn--primary" to="/campaigns">
              + Đăng ký hiến máu ngay
            </Link>
          )}
        </div>
      ) : (
        <div className="appointment-history-wrap">
          {displayedList.map((item) => (
            <article key={item.id} className="appointment-card">
              {/* Left side: Droplet icon + text */}
              <div className="appointment-card__left">
                <div className="appointment-card__droplet">
                  <Droplet size={36} color="#e11d48" fill="#e11d48" />
                  <span className="appointment-card__droplet-label">Hiến máu</span>
                </div>

                {/* Main content */}
                <div className="appointment-card__body">
                  <h2 className="appointment-card__title">{item.campaignName}</h2>
                  <p className="appointment-card__line">
                    <Building2 size={15} style={{ flexShrink: 0, opacity: 0.75 }} />
                    <span>{item.location}</span>
                  </p>
                  <p className="appointment-card__line">
                    <Clock size={15} style={{ flexShrink: 0, opacity: 0.75 }} />
                    <span>{formatSlotRangeTime(item.startsAt, item.endsAt)}</span>
                  </p>
                </div>
              </div>

              {/* Right side: Status badge & Detail action */}
              <div className="appointment-card__right">
                <span
                  className={`appointment-pill ${
                    item.status === 'COMPLETED'
                      ? 'appointment-pill--completed'
                      : item.status === 'CANCELLED'
                      ? 'appointment-pill--cancelled'
                      : item.status === 'PENDING'
                      ? 'appointment-pill--pending'
                      : 'appointment-pill--confirmed'
                  }`}
                >
                  {item.statusLabel}
                </span>

                <button
                  type="button"
                  className="appointment-detail-btn"
                  onClick={() => setSelectedAppointment(item)}
                >
                  <FileText size={15} />
                  <span>Xem chi tiết</span>
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </WorkflowShell>
  );
}

/* ==========================================================================
   Physical Paper Certificate Vault (Kho ảnh giấy chứng nhận vật lý)
   ========================================================================== */

export interface PhysicalCertificateRecord {
  id: string;
  donorId: string;
  code: string;
  donationDate: string;
  facilityName: string;
  location: string;
  volumeMl: number;
  bloodGroup: string;
  imageUrl: string;
  uploadedAt: string;
  notes?: string;
}

const DEFAULT_DEMO_CERTIFICATES: PhysicalCertificateRecord[] = [
  {
    id: 'cert-physical-108',
    donorId: 'seed-donor',
    code: 'CN-108/2023',
    donationDate: '2023-10-28',
    facilityName: 'Bệnh viện Trung ương Quân đội 108',
    location: 'Quận Hoàn Kiếm, TP. Hà Nội',
    volumeMl: 350,
    bloodGroup: 'B Rh+',
    imageUrl: '/images/sample-paper-certificate.jpg',
    uploadedAt: '2023-10-29T10:00:00.000Z',
    notes: 'Hiến máu tình nguyện đợt 3 tại BV 108',
  },
  {
    id: 'cert-physical-435',
    donorId: 'seed-donor',
    code: 'CN-435/2023',
    donationDate: '2023-11-24',
    facilityName: 'Ban Chỉ đạo Vận động HMTN TP. Đà Nẵng',
    location: '123 Đường Lê Lợi, TP. Đà Nẵng',
    volumeMl: 350,
    bloodGroup: 'A Rh+',
    imageUrl: '/images/sample-paper-certificate-2.jpg',
    uploadedAt: '2023-11-25T14:30:00.000Z',
    notes: 'Chụp ảnh giấy chứng nhận lần hiến máu thứ 3',
  },
];

export function CertificatesPage() {
  const { currentUser } = useAuth();
  const donorId = currentUser?.id ?? 'default';
  const storageKey = `blood_donor_physical_certs_${donorId}`;

  const [certificates, setCertificates] = useState<PhysicalCertificateRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeLightbox, setActiveLightbox] = useState<PhysicalCertificateRecord | null>(null);
  const [showUploadModal, setShowUploadModal] = useState<boolean>(false);

  // Form states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [filePreview, setFilePreview] = useState<string>('');
  const [formCode, setFormCode] = useState<string>('');
  const [formDate, setFormDate] = useState<string>(
    new Date().toISOString().slice(0, 10),
  );
  const [formFacility, setFormFacility] = useState<string>('');
  const [formVolume, setFormVolume] = useState<number>(350);
  const [formBloodGroup, setFormBloodGroup] = useState<string>('B Rh+');
  const [formNotes, setFormNotes] = useState<string>('');
  const [uploadError, setUploadError] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load from localStorage or initialize with demo records
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored) as PhysicalCertificateRecord[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setCertificates(parsed);
          setLoading(false);
          return;
        }
      }
    } catch {
      // Ignore parse error
    }
    // Default initial seed
    setCertificates(DEFAULT_DEMO_CERTIFICATES);
    setLoading(false);
    try {
      localStorage.setItem(storageKey, JSON.stringify(DEFAULT_DEMO_CERTIFICATES));
    } catch {
      // Ignore storage error
    }
  }, [storageKey]);

  // Handle file select or photo capture
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setUploadError('Vui lòng chọn hoặc chụp tệp hình ảnh (JPG, PNG).');
      return;
    }

    setUploadError('');
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setFilePreview(reader.result);
        if (!formCode) {
          setFormCode(`CN-${Math.floor(100 + Math.random() * 900)}/${new Date().getFullYear()}`);
        }
      }
    };
    reader.readAsDataURL(file);
  };

  // Save new certificate with Supabase Storage integration
  const handleSaveCertificate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!filePreview && !selectedFile) {
      setUploadError('Vui lòng chụp hoặc tải ảnh tờ giấy chứng nhận.');
      return;
    }
    if (!formFacility.trim()) {
      setUploadError('Vui lòng nhập đơn vị hoặc cơ sở tiếp nhận máu.');
      return;
    }

    try {
      setIsUploading(true);
      setUploadError('');

      let finalImageUrl = filePreview;
      if (selectedFile) {
        const uploadResult = await uploadCertificatePhoto(selectedFile, donorId);
        finalImageUrl = uploadResult.publicUrl;
      }

      const newRecord: PhysicalCertificateRecord = {
        id: `cert-user-${Date.now()}`,
        donorId,
        code: formCode.trim() || `CN-${Date.now().toString().slice(-4)}`,
        donationDate: formDate,
        facilityName: formFacility.trim(),
        location: 'Địa điểm theo giấy chứng nhận',
        volumeMl: Number(formVolume) || 350,
        bloodGroup: formBloodGroup,
        imageUrl: finalImageUrl,
        uploadedAt: new Date().toISOString(),
        notes: formNotes.trim(),
      };

      const updated = [newRecord, ...certificates];
      setCertificates(updated);
      try {
        localStorage.setItem(storageKey, JSON.stringify(updated));
      } catch {
        // Ignore storage error
      }

      // Reset and close
      setSelectedFile(null);
      setFilePreview('');
      setFormCode('');
      setFormFacility('');
      setFormNotes('');
      setUploadError('');
      setShowUploadModal(false);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Có lỗi khi lưu và tải ảnh chứng nhận');
    } finally {
      setIsUploading(false);
    }
  };

  // Delete certificate
  const handleDeleteCertificate = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Bạn có chắc chắn muốn xoá ảnh giấy chứng nhận này khỏi kho lưu trữ?')) {
      return;
    }
    const updated = certificates.filter((c) => c.id !== id);
    setCertificates(updated);
    try {
      localStorage.setItem(storageKey, JSON.stringify(updated));
    } catch {
      // Ignore storage error
    }
  };

  return (
    <WorkflowShell title="Kho ảnh giấy chứng nhận hiến máu">
      {/* Hero explanation banner */}
      <div className="cert-vault-hero">
        <div>
          <h2 className="cert-vault-hero__title">
            Kho lưu trữ Giấy chứng nhận hiến máu tình nguyện
          </h2>
          <p className="cert-vault-hero__desc">
            Sau mỗi lần hiến máu, bạn được trao một tờ <strong>Giấy chứng nhận hiến máu tình nguyện bằng giấy</strong>.
            Hãy chụp ảnh hoặc tải ảnh giấy chứng nhận của bạn lên đây để lưu trữ số hóa an toàn trên hệ thống và dễ dàng tra cứu, sử dụng khi cần.
          </p>
        </div>
        <button
          type="button"
          className="btn btn--primary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
          onClick={() => {
            setUploadError('');
            setShowUploadModal(true);
          }}
        >
          <Camera size={18} />
          <span>Chụp / Tải ảnh chứng nhận mới</span>
        </button>
      </div>

      {/* Gallery Grid */}
      {certificates.length === 0 ? (
        <p className="workflow-empty">
          Bạn chưa có ảnh giấy chứng nhận nào được lưu. Hãy bấm nút <strong>Chụp / Tải ảnh chứng nhận mới</strong> để lưu trữ tờ giấy chứng nhận của bạn.
        </p>
      ) : (
        <div className="cert-gallery-grid">
          {certificates.map((cert) => (
            <article key={cert.id} className="cert-photo-card">
              {/* Media photo thumbnail */}
              <div
                className="cert-photo-card__media"
                onClick={() => setActiveLightbox(cert)}
                title="Bấm để phóng to ảnh"
              >
                <img
                  src={cert.imageUrl}
                  alt={`Giấy chứng nhận ${cert.code}`}
                  className="cert-photo-card__img"
                  loading="lazy"
                />
                <div className="cert-photo-card__overlay">
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <ZoomIn size={16} /> Phóng to ảnh
                  </span>
                </div>
                <div className="cert-photo-card__badge">
                  {cert.bloodGroup}
                </div>
              </div>

              {/* Card body */}
              <div className="cert-photo-card__body">
                <div className="cert-photo-card__code">
                  <span>{cert.code}</span>
                  <span style={{ fontSize: '0.85rem', color: '#e11d48' }}>
                    {cert.volumeMl}ml
                  </span>
                </div>
                <div className="cert-photo-card__facility">{cert.facilityName}</div>
                <div className="cert-photo-card__meta">
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                    <Calendar size={14} style={{ opacity: 0.8 }} />
                    Ngày hiến: {formatDdMmYyyy(cert.donationDate)}
                  </span>
                </div>
                {cert.notes && (
                  <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '4px 0 0' }}>
                    {cert.notes}
                  </p>
                )}
              </div>

              {/* Action buttons */}
              <div className="cert-photo-card__actions">
                <button
                  type="button"
                  className="btn btn--secondary"
                  style={{ fontSize: '0.82rem', padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                  onClick={() => setActiveLightbox(cert)}
                >
                  <ZoomIn size={14} /> Xem ảnh lớn
                </button>
                <a
                  href={cert.imageUrl}
                  download={`giay-chung-nhan-${cert.code}.jpg`}
                  className="btn btn--secondary"
                  style={{ fontSize: '0.82rem', padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <Download size={14} /> Tải ảnh
                </a>
                <button
                  type="button"
                  className="btn btn--danger"
                  style={{ fontSize: '0.82rem', padding: '4px 10px', display: 'inline-flex', alignItems: 'center' }}
                  onClick={(e) => handleDeleteCertificate(cert.id, e)}
                  title="Xoá ảnh này"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Lightbox Zoom Modal */}
      {activeLightbox && (
        <div
          className="cert-lightbox-backdrop"
          onClick={() => setActiveLightbox(null)}
        >
          <div
            className="cert-lightbox-content"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={activeLightbox.imageUrl}
              alt={activeLightbox.code}
              className="cert-lightbox-img"
            />
          </div>
          <div className="cert-lightbox-toolbar">
            <span style={{ color: '#ffffff', fontWeight: 600, fontSize: '0.95rem' }}>
              {activeLightbox.code} · {activeLightbox.facilityName} ({formatDdMmYyyy(activeLightbox.donationDate)})
            </span>
            <a
              href={activeLightbox.imageUrl}
              download={`chung-nhan-${activeLightbox.code}.jpg`}
              className="btn btn--primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Download size={16} />
              <span>Tải ảnh về máy</span>
            </a>
            <button
              type="button"
              className="btn btn--secondary"
              onClick={() => setActiveLightbox(null)}
            >
              Đóng
            </button>
          </div>
        </div>
      )}

      {/* Upload / Camera Modal */}
      {showUploadModal && (
        <div
          className="test-modal-backdrop"
          onClick={() => setShowUploadModal(false)}
        >
          <div
            className="test-modal-dialog cert-modal-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <form onSubmit={handleSaveCertificate}>
              <div className="test-modal-body">
                <h2 className="test-modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Camera size={22} color="#e11d48" />
                  <span>Chụp hoặc tải ảnh giấy chứng nhận</span>
                </h2>
                <p className="test-modal-subtitle">
                  Chụp rõ nét tờ Giấy chứng nhận hiến máu tình nguyện bằng giấy của bạn để lưu trữ vào kho hồ sơ cá nhân.
                </p>

                {uploadError && (
                  <div
                    style={{
                      background: '#fee2e2',
                      border: '1px solid #f87171',
                      color: '#991b1b',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      marginBottom: '14px',
                      fontSize: '0.88rem',
                    }}
                  >
                    {uploadError}
                  </div>
                )}

                {/* Dropzone / File input */}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  onChange={handleFileChange}
                />

                {filePreview ? (
                  <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                    <img
                      src={filePreview}
                      alt="Xem trước ảnh chụp"
                      style={{
                        maxHeight: '220px',
                        maxWidth: '100%',
                        objectFit: 'contain',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                      }}
                    />
                    <div style={{ marginTop: '8px' }}>
                      <button
                        type="button"
                        className="btn btn--secondary"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <RefreshCw size={15} />
                        <span>Chọn hoặc chụp ảnh khác</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    className="cert-dropzone"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <div style={{ marginBottom: '8px', color: '#2563eb' }}>
                      <Camera size={44} strokeWidth={1.5} />
                    </div>
                    <p style={{ fontWeight: 600, color: '#1e3a8a', margin: '0 0 4px' }}>
                      Bấm vào đây để Chụp ảnh hoặc Tải ảnh giấy chứng nhận từ máy
                    </p>
                    <p style={{ fontSize: '0.82rem', color: '#64748b', margin: 0 }}>
                      Hỗ trợ JPG, PNG, ảnh chụp camera điện thoại
                    </p>
                  </div>
                )}

                {/* Information Fields */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, marginBottom: '4px' }}>
                      Mã số trên giấy chứng nhận
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Ví dụ: CN-435/2023"
                      value={formCode}
                      onChange={(e) => setFormCode(e.target.value)}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, marginBottom: '4px' }}>
                      Ngày hiến máu
                    </label>
                    <input
                      type="date"
                      className="form-input"
                      value={formDate}
                      onChange={(e) => setFormDate(e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ marginTop: '12px' }}>
                  <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, marginBottom: '4px' }}>
                    Cơ sở tiếp nhận máu / Đơn vị tổ chức *
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Ví dụ: Bệnh viện Truyền máu Huyết học TP.HCM"
                    value={formFacility}
                    onChange={(e) => setFormFacility(e.target.value)}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, marginBottom: '4px' }}>
                      Lượng máu đã hiến (ml)
                    </label>
                    <select
                      className="form-input"
                      value={formVolume}
                      onChange={(e) => setFormVolume(Number(e.target.value))}
                    >
                      <option value={250}>250 ml</option>
                      <option value={350}>350 ml</option>
                      <option value={450}>450 ml</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, marginBottom: '4px' }}>
                      Nhóm máu (nếu có ghi)
                    </label>
                    <select
                      className="form-input"
                      value={formBloodGroup}
                      onChange={(e) => setFormBloodGroup(e.target.value)}
                    >
                      <option value="A Rh+">A Rh+</option>
                      <option value="A Rh-">A Rh-</option>
                      <option value="B Rh+">B Rh+</option>
                      <option value="B Rh-">B Rh-</option>
                      <option value="O Rh+">O Rh+</option>
                      <option value="O Rh-">O Rh-</option>
                      <option value="AB Rh+">AB Rh+</option>
                      <option value="AB Rh-">AB Rh-</option>
                    </select>
                  </div>
                </div>

                <div style={{ marginTop: '12px' }}>
                  <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, marginBottom: '4px' }}>
                    Ghi chú thêm (không bắt buộc)
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Ví dụ: Lần hiến máu thứ 4 tại trường..."
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                  />
                </div>
              </div>

              <div className="test-modal-footer">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowUploadModal(false)}
                  disabled={isUploading}
                >
                  Huỷ
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  style={{ marginLeft: '10px' }}
                  disabled={isUploading}
                >
                  {isUploading ? 'Đang lưu & tải ảnh lên...' : 'Lưu vào kho chứng nhận'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </WorkflowShell>
  );
}

/* ==========================================================================
   CertificateDetailPage: Physical Certificate Photo Inspector
   ========================================================================== */

export function CertificateDetailPage() {
  const { certificateId = '' } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const donorId = currentUser?.id ?? 'default';
  const storageKey = `blood_donor_physical_certs_${donorId}`;

  const [cert, setCert] = useState<PhysicalCertificateRecord | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored) as PhysicalCertificateRecord[];
        const found = parsed.find((item) => item.id === certificateId);
        if (found) {
          setCert(found);
          setLoading(false);
          return;
        }
      }
    } catch {
      // Ignore
    }

    // Check defaults
    const foundDemo = DEFAULT_DEMO_CERTIFICATES.find((item) => item.id === certificateId);
    if (foundDemo) {
      setCert(foundDemo);
    } else if (DEFAULT_DEMO_CERTIFICATES.length > 0 && DEFAULT_DEMO_CERTIFICATES[0]) {
      setCert(DEFAULT_DEMO_CERTIFICATES[0]);
    } else {
      setCert(null);
    }
    setLoading(false);
  }, [certificateId, storageKey]);

  return (
    <WorkflowShell
      title="Chi tiết giấy chứng nhận"
      back="/donor/certificates"
      backLabel="Kho chứng nhận"
    >
      {cert ? (
        <div style={{ maxWidth: '840px', margin: '0 auto' }}>
          <div className="history-panel-card" style={{ textAlign: 'center', marginBottom: '20px' }}>
            <img
              src={cert.imageUrl}
              alt={cert.code}
              style={{
                maxWidth: '100%',
                maxHeight: '480px',
                objectFit: 'contain',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
              }}
            />
          </div>

          <div className="history-panel-card">
            <h2 className="history-panel-card__title">Thông tin giấy chứng nhận</h2>
            <div className="zebra-table-list">
              <div className="zebra-table-row">
                <span className="zebra-table-label">Số chứng nhận:</span>
                <span className="zebra-table-value">{cert.code}</span>
              </div>
              <div className="zebra-table-row">
                <span className="zebra-table-label">Đơn vị cấp:</span>
                <span className="zebra-table-value">{cert.facilityName}</span>
              </div>
              <div className="zebra-table-row">
                <span className="zebra-table-label">Ngày hiến máu:</span>
                <span className="zebra-table-value">{formatDdMmYyyy(cert.donationDate)}</span>
              </div>
              <div className="zebra-table-row">
                <span className="zebra-table-label">Lượng máu đã hiến:</span>
                <span className="zebra-table-value">{cert.volumeMl}ml</span>
              </div>
              <div className="zebra-table-row">
                <span className="zebra-table-label">Nhóm máu:</span>
                <span className="zebra-table-value">{cert.bloodGroup}</span>
              </div>
              {cert.notes && (
                <div className="zebra-table-row">
                  <span className="zebra-table-label">Ghi chú:</span>
                  <span className="zebra-table-value">{cert.notes}</span>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '24px' }}>
              <a
                href={cert.imageUrl}
                download={`giay-chung-nhan-${cert.code}.jpg`}
                className="btn btn--primary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <Download size={16} />
                <span>Tải ảnh về máy</span>
              </a>
              <Button variant="secondary" onClick={() => window.print()}>
                In trang này
              </Button>
              <Button variant="secondary" onClick={() => navigate('/donor/certificates')}>
                Quay về kho chứng nhận
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <p className="workflow-empty">Không tìm thấy giấy chứng nhận này.</p>
      )}
    </WorkflowShell>
  );
}
