import { useState, useRef } from 'react';
import { useInvoice } from '@/features/invoice/context/InvoiceContext';
import { useHistory } from '@/features/invoice/hooks/useHistory';
import { useCounters } from '@/features/invoice/hooks/useCounters';
import { buildPDFBlob, buildFilename } from '@/features/invoice/utils/pdf';
import { saveToDrive } from '@/features/invoice/utils/drive';
import { motion, AnimatePresence } from 'framer-motion';
import { CustomSelect } from '@/components/ui/custom-select';

const SENDER_EMAIL = 'antigoneconsulting.finance@gmail.com';

const FR_MONTHS = [
  'janvier','février','mars','avril','mai','juin',
  'juillet','août','septembre','octobre','novembre','décembre',
];

function fmtInvoiceMonth(dateISO: string): string {
  if (!dateISO) return '';
  const [y, m] = dateISO.split('-').map(Number);
  return `${FR_MONTHS[m - 1]} ${y}`;
}

function buildDefaultSubject(docType: string, docDate: string): string {
  const month = fmtInvoiceMonth(docDate);
  const label = docType === 'Devis' ? 'Devis' : 'Facture';
  return `${label}${month ? ` ${month}` : ''} — Antigone`;
}

function buildDefaultBody(
  docType: string,
  docDate: string,
  client?: { email_receiver_gender?: string | null; email_receiver_name?: string | null } | null,
): string {
  const month = fmtInvoiceMonth(docDate);
  const label = docType === 'Devis' ? 'le devis' : 'la facture';

  let greeting = 'Madame, Monsieur,';
  const gender = client?.email_receiver_gender;
  const receiverName = client?.email_receiver_name?.trim();
  if (gender) {
    const civility = gender === 'Mme' ? 'Madame' : 'Monsieur';
    greeting = receiverName ? `${civility} ${receiverName},` : `${civility},`;
  }

  return [
    greeting,
    '',
    `Veuillez trouver ci-joint ${label} relative à nos prestations du ${month}.`,
    '',
    'Nous vous remercions de votre confiance et restons à votre disposition pour toute information complémentaire.',
    '',
    'Cordialement,',
  ].join('\n');
}

function buildVersionOptions(min: number) {
  return Array.from({ length: 21 - min }, (_, i) => ({
    value: String(min + i),
    label: `Version ${min + i}`,
  }));
}

export default function PreviewHeader() {
  const { state } = useInvoice();
  const {
    checkActionForVersion,
    checkAlreadyDownloaded,
    checkAlreadySavedToDrive,
    checkAlreadySentByEmail,
    getUsedVersions,
    saveToHistory,
  } = useHistory();
  const { saveCounter, advanceDocNum } = useCounters();

  const [downloading, setDownloading] = useState(false);
  const [driving,     setDriving]     = useState(false);
  const [sending,     setSending]     = useState(false);
  const [validationError, setValidationError] = useState('');

  const emailedNums = useRef<Set<string>>(new Set());
  const lastDownloadedDocNum = useRef<string>('');

  const [showVersionPicker,   setShowVersionPicker]   = useState(false);
  const [pickerVersion,       setPickerVersion]       = useState('2');
  const [pickerMinVersion,    setPickerMinVersion]    = useState(2);
  const [pickerAction,        setPickerAction]        = useState<'download' | 'drive' | 'email' | null>(null);
  const [pickerError,         setPickerError]         = useState('');
  const [pickerLoading,       setPickerLoading]       = useState(false);

  const [showEmailModal,    setShowEmailModal]    = useState(false);
  const [emailTo,           setEmailTo]           = useState('');
  const [emailSubject,      setEmailSubject]      = useState('');
  const [emailBody,         setEmailBody]         = useState('');
  const [emailError,        setEmailError]        = useState('');
  const [emailTargetDocNum, setEmailTargetDocNum] = useState('');
  const [emailVersion,      setEmailVersion]      = useState(1);

  function getPageEl(): HTMLElement | null {
    return document.querySelector('#a4Pages .a4-page');
  }

  const { docType, docNum, docDate, currentClient, fixDocument, cats, iHT } = state;
  const isDevis  = docType === 'Devis';
  const dbType   = isDevis ? 'devis' : 'facture';
  const filename = buildFilename(docType, docNum, currentClient?.name);

  const hasClient   = !!currentClient;
  const hasServices = cats.some((c: any) => c.selected.length > 0);
  const hasHT       = parseFloat(String(iHT)) > 0;

  function checkConditions(): boolean {
    if (!hasClient)   { setValidationError('Veuillez sélectionner un client.'); return false; }
    if (!hasServices) { setValidationError('Veuillez sélectionner au moins un service.'); return false; }
    if (!hasHT)       { setValidationError('Veuillez renseigner le montant HT.'); return false; }
    setValidationError('');
    return true;
  }

  function getActionDocNum(): string {
    return (lastDownloadedDocNum.current && lastDownloadedDocNum.current !== docNum)
      ? lastDownloadedDocNum.current
      : docNum;
  }

  async function openVersionPicker(action: 'download' | 'drive' | 'email') {
    if (!checkConditions()) return;

    const used = await getUsedVersions(docType, docNum);
    if (used.length >= 20) {
      setValidationError('Maximum de 20 versions atteint pour ce document.');
      return;
    }

    const maxUsed = used.length > 0 ? Math.max(...used) : 1;
    const minSelectable = Math.max(2, maxUsed);

    setPickerMinVersion(minSelectable);
    setPickerVersion('');
    setPickerAction(action);
    setPickerError('');
    setShowVersionPicker(true);
  }

  async function handleConfirmVersion() {
    if (!pickerAction) return;

    const v = parseInt(pickerVersion, 10);
    if (!pickerVersion || isNaN(v) || v < 2) {
      setPickerError('Veuillez sélectionner une version.');
      return;
    }

    setPickerLoading(true);
    setPickerError('');

    const usedNow = await getUsedVersions(docType, docNum);
    const currentMax = usedNow.length > 0 ? Math.max(...usedNow) : 1;
    if (v < currentMax) {
      setPickerError(`La V${currentMax} existe déjà. Vous ne pouvez plus modifier la V${v} — sélectionnez V${currentMax} ou créez une nouvelle version.`);
      setPickerMinVersion(Math.max(2, currentMax));
      setPickerVersion(String(Math.max(2, currentMax)));
      setPickerLoading(false);
      return;
    }

    const exists = await checkActionForVersion(docType, docNum, pickerAction, v);
    if (exists) {
      const actionLabel = pickerAction === 'download' ? 'PDF' : pickerAction === 'drive' ? 'Drive' : 'Email';
      setPickerError(`La V${v} a déjà l'action « ${actionLabel} » enregistrée. Choisissez une autre version.`);
      setPickerLoading(false);
      return;
    }

    setShowVersionPicker(false);
    setPickerLoading(false);

    if (pickerAction === 'download') {
      await doDownload(v);
    } else if (pickerAction === 'drive') {
      await doDrive(v);
    } else {
      openEmailModalWithVersion(v, docNum);
    }
  }

  async function handleDownload() {
    if (downloading) return;
    if (fixDocument) {
      await openVersionPicker('download');
      return;
    }
    if (!checkConditions()) return;
    const exists = await checkAlreadyDownloaded(docType, docNum);
    if (exists) {
      alert('Ce document a déjà été téléchargé. Cochez "Facture fixing" pour forcer.');
      return;
    }
    await doDownload(1);
  }

  async function doDownload(version: number) {
    const pageEl = getPageEl();
    if (!pageEl) return;
    setDownloading(true);

    try {
      const blob = await buildPDFBlob(pageEl, filename);
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download error:', err);
      alert('Erreur lors de la génération du PDF.');
      setDownloading(false);
      return;
    }

    try {
      await saveToHistory('download', { docNum, version });
      await saveCounter(dbType, docNum);
      if (version === 1) {
        lastDownloadedDocNum.current = docNum;
        advanceDocNum(dbType);
      }
    } catch (err: any) {
      console.error('History save error:', err);
    } finally {
      setDownloading(false);
    }
  }

  async function handleDrive() {
    if (driving) return;
    if (fixDocument) {
      await openVersionPicker('drive');
      return;
    }
    if (!checkConditions()) return;
    const targetDocNum = getActionDocNum();
    const exists = await checkAlreadySavedToDrive(docType, targetDocNum);
    if (exists) {
      alert('Cette facture a déjà été enregistrée. Cochez "Facture fixing" pour forcer.');
      return;
    }
    await doDrive(1, targetDocNum);
  }

  async function doDrive(version: number, targetDocNum?: string) {
    const saveDocNum = targetDocNum ?? docNum;
    setDriving(true);

    try {
      await saveToHistory('drive', { docNum: saveDocNum, version });
      await saveCounter(dbType, saveDocNum);
      alert('Facture enregistrée avec succès dans la base de données !');
    } catch (err: any) {
      console.error('Save error:', err);
      alert(`Erreur lors de l'enregistrement :\n${err.message}`);
    } finally {
      setDriving(false);
    }
  }

  async function openEmailModal() {
    if (sending) return;
    if (fixDocument) {
      await openVersionPicker('email');
      return;
    }
    if (!checkConditions()) return;
    const targetDocNum = getActionDocNum();
    if (emailedNums.current.has(targetDocNum)) {
      alert('Ce document a déjà été envoyé par email. Cochez "Facture fixing" pour forcer.');
      return;
    }
    const exists = await checkAlreadySentByEmail(docType, targetDocNum);
    if (exists) {
      emailedNums.current.add(targetDocNum);
      alert('Ce document a déjà été envoyé par email. Cochez "Facture fixing" pour forcer.');
      return;
    }
    openEmailModalWithVersion(1, targetDocNum);
  }

  function openEmailModalWithVersion(version: number, targetDocNum: string) {
    setEmailTargetDocNum(targetDocNum);
    setEmailVersion(version);
    setEmailTo(currentClient?.email || '');
    setEmailSubject(buildDefaultSubject(docType, docDate));
    setEmailBody(buildDefaultBody(docType, docDate, currentClient));
    setEmailError('');
    setShowEmailModal(true);
  }

  async function handleSendEmail() {
    if (sending) return;
    if (!emailTo.trim()) { setEmailError("Veuillez renseigner l'adresse email du destinataire."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTo.trim())) { setEmailError('Adresse email invalide.'); return; }

    const pageEl = getPageEl();
    if (!pageEl) return;

    setSending(true);
    setEmailError('');

    let pdfBase64: string;
    try {
      const blob  = await buildPDFBlob(pageEl, filename);
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let binary  = '';
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      pdfBase64 = btoa(binary);
    } catch (err) {
      console.error('PDF generation error:', err);
      setEmailError('Erreur lors de la génération du PDF.');
      setSending(false);
      return;
    }

    try {
      const res = await fetch('/api/send-invoice', {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(() => {
            try {
              const a = JSON.parse(localStorage.getItem('finace:auth') || '{}');
              return a.accessToken ? { Authorization: `Bearer ${a.accessToken}` } : {};
            } catch { return {}; }
          })(),
        } as Record<string, string>,
        body:    JSON.stringify({ to: emailTo.trim(), subject: emailSubject, body: emailBody, pdfBase64, filename }),
      });
      if (!res.ok) {
        const data = await res.json();
        setEmailError(data.error || "Erreur lors de l'envoi.");
        setSending(false);
        return;
      }
    } catch (err) {
      console.error('Send email error:', err);
      setEmailError("Erreur réseau lors de l'envoi.");
      setSending(false);
      return;
    }

    if (emailVersion === 1) emailedNums.current.add(emailTargetDocNum);

    try {
      await saveToHistory('email', { docNum: emailTargetDocNum, version: emailVersion });
      await saveCounter(dbType, emailTargetDocNum);
    } catch (err: any) {
      console.error('History save error:', err);
      alert(`Email envoyé, mais erreur DB :\n${err?.message || JSON.stringify(err)}`);
    }

    setSending(false);
    setShowEmailModal(false);
    alert(`Email envoyé à ${emailTo} avec succès !`);
  }

  return (
    <div className="preview-header-wrap">
      <div className="preview-header">
        <span className="preview-label">Aperçu — A4</span>
        <div className="preview-buttons">
          <motion.button
            type="button"
            className="btn-print"
            onClick={handleDownload}
            disabled={downloading}
            whileTap={{ scale: 0.95 }}
            whileHover={{ scale: 1.03 }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            {downloading ? 'Génération…' : 'Télécharger PDF'}
          </motion.button>

          <motion.button
            type="button"
            className="btn-print btn-pill--drive"
            onClick={handleDrive}
            disabled={driving}
            whileTap={{ scale: 0.95 }}
            whileHover={{ scale: 1.03 }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v14a2 2 0 0 1-2 2z"/>
              <polyline points="17 21 17 13 7 13 7 21"/>
              <polyline points="7 3 7 8 15 8"/>
            </svg>
            {driving ? 'Sauvegarde…' : 'Finaliser Facture'}
          </motion.button>

          <motion.button
            type="button"
            className="btn-print btn-pill--email"
            onClick={openEmailModal}
            disabled={sending}
            whileTap={{ scale: 0.95 }}
            whileHover={{ scale: 1.03 }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
              <polyline points="22,6 12,13 2,6"/>
            </svg>
            Envoyer par email
          </motion.button>
        </div>
      </div>

      <AnimatePresence>
        {validationError && (
          <motion.div
            className="export-toast"
            initial={{ opacity: 0, y: -12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.95 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          >
            <div className="export-toast-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            </div>
            <span className="export-toast-msg">{validationError}</span>
            <motion.button
              className="export-toast-close"
              onClick={() => setValidationError('')}
              whileTap={{ scale: 0.85 }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Version picker modal */}
      <AnimatePresence>
        {showVersionPicker && (
          <motion.div
            className="email-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !pickerLoading && setShowVersionPicker(false)}
          >
            <motion.div
              className="email-modal"
              style={{ maxWidth: 360 }}
              initial={{ scale: 0.94, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.94, opacity: 0, y: 20 }}
              transition={{ type: 'spring', damping: 26, stiffness: 320 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="email-modal-hdr">
                <div className="email-modal-hdr-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </div>
                <div>
                  <div className="email-modal-title">Choisir la version</div>
                  <div className="email-modal-sub">
                    {pickerAction === 'download' ? 'Télécharger PDF' : pickerAction === 'drive' ? 'Finaliser Facture' : 'Envoyer par email'} — {docNum}
                  </div>
                </div>
                <button
                  className="email-modal-close"
                  onClick={() => !pickerLoading && setShowVersionPicker(false)}
                  disabled={pickerLoading}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>

              <div className="email-modal-body">
                <div className="email-field-row">
                  <label className="email-field-label">Version</label>
                  <CustomSelect
                    value={pickerVersion}
                    onChange={setPickerVersion}
                    options={buildVersionOptions(pickerMinVersion)}
                    placeholder="Sélectionner…"
                    size="sm"
                  />
                </div>
                {pickerError && <div className="email-error">{pickerError}</div>}
              </div>

              <div className="email-modal-footer">
                <button className="btn-pill btn-pill--ghost" onClick={() => setShowVersionPicker(false)} disabled={pickerLoading}>
                  Annuler
                </button>
                <motion.button
                  className="btn-pill btn-pill--send"
                  onClick={handleConfirmVersion}
                  disabled={pickerLoading}
                  whileTap={{ scale: 0.95 }}
                  whileHover={{ scale: 1.02 }}
                >
                  {pickerLoading ? 'Vérification…' : 'Confirmer'}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Email compose modal */}
      <AnimatePresence>
        {showEmailModal && (
          <motion.div
            className="email-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !sending && setShowEmailModal(false)}
          >
            <motion.div
              className="email-modal"
              initial={{ scale: 0.94, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.94, opacity: 0, y: 20 }}
              transition={{ type: 'spring', damping: 26, stiffness: 320 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="email-modal-hdr">
                <div className="email-modal-hdr-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                    <polyline points="22,6 12,13 2,6"/>
                  </svg>
                </div>
                <div>
                  <div className="email-modal-title">
                    Envoyer par email{emailVersion > 1 ? ` — V${emailVersion}` : ''}
                  </div>
                  <div className="email-modal-sub">Le PDF sera joint automatiquement</div>
                </div>
                <button
                  className="email-modal-close"
                  onClick={() => !sending && setShowEmailModal(false)}
                  disabled={sending}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>

              <div className="email-modal-body">
                <div className="email-field-row">
                  <label className="email-field-label">De</label>
                  <div className="email-field-readonly">{SENDER_EMAIL}</div>
                </div>
                <div className="email-field-row">
                  <label className="email-field-label">À <span className="email-req">*</span></label>
                  <input
                    type="email"
                    className="email-field-input"
                    value={emailTo}
                    onChange={(e) => setEmailTo(e.target.value)}
                    placeholder="email@client.com"
                    disabled={sending}
                  />
                </div>
                <div className="email-field-row">
                  <label className="email-field-label">Objet</label>
                  <input
                    type="text"
                    className="email-field-input"
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    disabled={sending}
                  />
                </div>
                <div className="email-field-row email-field-row--top">
                  <label className="email-field-label">Message</label>
                  <textarea
                    className="email-field-textarea"
                    value={emailBody}
                    onChange={(e) => setEmailBody(e.target.value)}
                    rows={9}
                    disabled={sending}
                  />
                </div>
                <div className="email-attachment-pill">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                  </svg>
                  {filename}
                </div>
                {emailError && <div className="email-error">{emailError}</div>}
              </div>

              <div className="email-modal-footer">
                <button className="btn-pill btn-pill--ghost" onClick={() => setShowEmailModal(false)} disabled={sending}>
                  Annuler
                </button>
                <motion.button
                  className="btn-pill btn-pill--send"
                  onClick={handleSendEmail}
                  disabled={sending}
                  whileTap={{ scale: 0.95 }}
                  whileHover={{ scale: 1.02 }}
                >
                  {sending ? (
                    <>
                      <svg className="email-spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                      </svg>
                      Envoi en cours…
                    </>
                  ) : (
                    <>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <line x1="22" y1="2" x2="11" y2="13"/>
                        <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                      </svg>
                      Envoyer
                    </>
                  )}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
