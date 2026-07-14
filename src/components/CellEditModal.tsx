import React, { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api.ts';
import { X, Loader2, History, MessageSquare, Paperclip, Send, Download, FileCode, CheckSquare, Clock, Edit2, Check } from 'lucide-react';
import { Task, HistoryRecord, Comment, Attachment, StatusType, SIOPSMembrosType, SIOPEFolhaType, STATUS_COLORS, STATUS_BG_COLORS } from '../types.ts';
import { useAuth } from '../contexts/AuthContext.tsx';

interface CellEditModalProps {
  task: Task;
  municipalityName: string;
  token: string | null;
  initialTab?: 'alterar' | 'historico' | 'comentarios';
  onClose: () => void;
  onUpdate: () => void;
}

export const CellEditModal: React.FC<CellEditModalProps> = ({
  task,
  municipalityName,
  token,
  initialTab = 'alterar',
  onClose,
  onUpdate,
}) => {
  const { postgresUser, user, employees } = useAuth();
  const [activeTab, setActiveTab] = useState<'alterar' | 'historico' | 'comentarios'>(initialTab);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);
  const [loadingAttachments, setLoadingAttachments] = useState(false);

  // Lists
  const [historyList, setHistoryList] = useState<HistoryRecord[]>([]);
  const [commentsList, setCommentsList] = useState<Comment[]>([]);
  const [attachmentsList, setAttachmentList] = useState<Attachment[]>([]);

  // Form States (Alterar)
  const [status, setStatus] = useState<StatusType>(task.status);
  const [siopsMembros, setSiopsMembros] = useState<SIOPSMembrosType | ''>((task.siopsMembros as SIOPSMembrosType) || '');
  const [siopeFolha, setSiopeFolha] = useState<SIOPEFolhaType | ''>((task.siopeFolha as SIOPEFolhaType) || '');
  const [changeName, setChangeName] = useState('');
  const [changeObservation, setChangeObservation] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // New Comment State
  const [newComment, setNewComment] = useState('');
  const [commentAuthor, setCommentAuthor] = useState('');
  const [isSavingComment, setIsSavingComment] = useState(false);

  // Upload State
  const [uploadingFile, setUploadingFile] = useState(false);

  // Edit History State
  const [editingHistoryId, setEditingHistoryId] = useState<number | null>(null);
  const [editOldValue, setEditOldValue] = useState<string>('');
  const [editNewValue, setEditNewValue] = useState<string>('');
  const [editUserWhoChanged, setEditUserWhoChanged] = useState<string>('');
  const [editObservation, setEditObservation] = useState<string>('');
  const [isSavingHistory, setIsSavingHistory] = useState<boolean>(false);
  const [customUserActive, setCustomUserActive] = useState<boolean>(false);

  const handleStartEditHistory = (h: HistoryRecord) => {
    setEditingHistoryId(h.id);
    setEditOldValue(h.oldValue || '');
    setEditNewValue(h.newValue || '');
    setEditUserWhoChanged(h.userWhoChanged || '');
    setEditObservation(h.observation || '');
    setCustomUserActive(false);
  };

  const handleCancelEditHistory = () => {
    setEditingHistoryId(null);
  };

  const handleSaveHistory = async (id: number) => {
    setIsSavingHistory(true);
    try {
      const hRecord = historyList.find((h) => h.id === id);
      const res = await apiFetch(`/api/history/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          oldValue: editOldValue || null,
          newValue: editNewValue || null,
          userWhoChanged: editUserWhoChanged || null,
          observation: editObservation || null,
        }),
      });
      if (res.ok) {
        await fetchHistory();
        setEditingHistoryId(null);

        // Update the form states of the main registration screen
        if (hRecord) {
          if (hRecord.fieldChanged === 'status' && editNewValue) {
            setStatus(editNewValue as StatusType);
          } else if (hRecord.fieldChanged === 'siopsMembros' && editNewValue) {
            setSiopsMembros(editNewValue as SIOPSMembrosType);
          } else if (hRecord.fieldChanged === 'siopeFolha' && editNewValue) {
            setSiopeFolha(editNewValue as SIOPEFolhaType);
          }
        }

        // Switch back to the registration screen ('alterar')
        setActiveTab('alterar');

        onUpdate();
      }
    } catch (err) {
      console.error('Error saving history:', err);
    } finally {
      setIsSavingHistory(false);
    }
  };

  const getOptionsForField = (field: string) => {
    if (field === 'status') {
      return ['Falta XML', 'Não iniciado', 'Pendência Cliente', 'Trabalhando', 'Retificar', 'Enviado', 'Homologado'];
    }
    return ['Não Solicitado', 'Solicitado', 'Recebido', 'Importado', 'Críticas', 'Diferença Folha', 'Sem críticas'];
  };

  // Fetch cell history
  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await apiFetch(`/api/tasks/${task.id}/history`);
      if (res.ok) {
        const data = await res.json();
        setHistoryList(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Fetch cell comments
  const fetchComments = async () => {
    setLoadingComments(true);
    try {
      const res = await apiFetch(`/api/tasks/${task.id}/comments`);
      if (res.ok) {
        const data = await res.json();
        setCommentsList(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingComments(false);
    }
  };

  // Fetch cell attachments
  const fetchAttachments = async () => {
    setLoadingAttachments(true);
    try {
      const res = await apiFetch(`/api/tasks/${task.id}/attachments`);
      if (res.ok) {
        const data = await res.json();
        setAttachmentList(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingAttachments(false);
    }
  };

  useEffect(() => {
    // onIdTokenChanged triggers on sign-in, sign-out, and auto background token refreshes by the Firebase SDK
    if (activeTab === 'historico') {
      fetchHistory();
    } else if (activeTab === 'comentarios') {
      fetchComments();
      fetchAttachments();
    }
  }, [activeTab]);

  // Initialize changeName and commentAuthor based on user's linked employee
  useEffect(() => {
    const isMetabit = user?.email?.trim().toLowerCase() === 'comercialmetabit@gmail.com';
    const defaultName = isMetabit ? 'Administrador' : (postgresUser?.employeeName || '');
    if (defaultName) {
      setChangeName(defaultName);
      setCommentAuthor(defaultName);
    }
  }, [postgresUser, user]);

  // Handle cell status update (Janela de Alteração saving)
  const handleSaveAlteration = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check if there's actually a change
    const isStatusChanged = status !== task.status;
    const isMembrosChanged = task.obligationCode === 'SIOPS' && siopsMembros !== task.siopsMembros;
    const isFolhaChanged = task.obligationCode === 'SIOPE' && siopeFolha !== task.siopeFolha;

    if (!isStatusChanged && !isMembrosChanged && !isFolhaChanged) {
      alert('Nenhuma alteração foi realizada.');
      return;
    }

    if (!changeName.trim()) {
      alert('Por favor, informe ou selecione o seu nome para registrar a alteração no histórico.');
      return;
    }

    setIsSaving(true);
    try {
      const res = await apiFetch(`/api/tasks/${task.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status,
          siopsMembros: task.obligationCode === 'SIOPS' ? siopsMembros : undefined,
          siopeFolha: task.obligationCode === 'SIOPE' ? siopeFolha : undefined,
          userWhoChanged: changeName || undefined,
          observation: changeObservation || undefined,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Falha ao atualizar tarefa.');
      }

      onUpdate();
      onClose();
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Erro ao salvar alteração.');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle saving comment
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setIsSavingComment(true);
    try {
      const res = await apiFetch(`/api/tasks/${task.id}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: newComment,
          authorName: commentAuthor || undefined,
        }),
      });

      if (res.ok) {
        setNewComment('');
        fetchComments();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingComment(false);
    }
  };

  // Handle file attachment upload (Read file as Base64 first)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (max 10MB to avoid excessive strain, but server supports up to 50MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('O arquivo excede o limite recomendado de 10MB.');
      return;
    }

    setUploadingFile(true);

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64Data = (reader.result as string).split(',')[1];

        const res = await apiFetch(`/api/tasks/${task.id}/attachments`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            fileName: file.name,
            fileType: file.type || 'application/octet-stream',
            fileSize: file.size,
            fileData: base64Data,
          }),
        });

        if (!res.ok) {
          throw new Error('Falha no upload do arquivo.');
        }

        fetchAttachments();
      } catch (err: any) {
        console.error(err);
        alert(err.message || 'Erro ao fazer upload.');
      } finally {
        setUploadingFile(false);
      }
    };

    reader.onerror = () => {
      alert('Erro ao ler arquivo.');
      setUploadingFile(false);
    };

    reader.readAsDataURL(file);
  };

  // Safe file downloader
  const handleDownloadFile = async (att: Attachment) => {
    try {
      const res = await apiFetch(`/api/attachments/${att.id}?json=true`);
      if (!res.ok) throw new Error();
      const data = await res.json();

      const byteCharacters = atob(data.fileData);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: data.fileType });

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', data.fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert('Erro ao baixar arquivo do banco de dados.');
    }
  };

  const hasChanges = status !== task.status ||
    (task.obligationCode === 'SIOPS' && siopsMembros !== task.siopsMembros) ||
    (task.obligationCode === 'SIOPE' && siopeFolha !== task.siopeFolha);

  const formatDateTime = (isoStr: string) => {
    const d = new Date(isoStr);
    return {
      date: d.toLocaleDateString('pt-BR'),
      time: d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    };
  };

  const getStatusBadgeStyle = (stat: StatusType) => {
    const color = STATUS_COLORS[stat] || '#374151';
    const bg = STATUS_BG_COLORS[stat] || '#F3F4F6';
    return {
      backgroundColor: bg,
      color: color,
      borderColor: 'transparent',
    };
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-xs animate-fade-in">
      <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-2xl rounded-2xl max-w-4xl w-full h-[90vh] sm:h-[80vh] flex flex-col overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/50">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-gray-900 dark:text-white text-base">{municipalityName}</h3>
              <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-bold px-2 py-0.5 rounded-full">
                {task.obligationCode}
              </span>
              <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold px-2 py-0.5 rounded-full">
                {task.competence} / {task.year}
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Última atualização: {new Date(task.updatedAt).toLocaleString('pt-BR')}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg cursor-pointer transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 px-4">
          <button
            onClick={() => setActiveTab('alterar')}
            className={`flex items-center gap-2 px-4 py-3.5 border-b-2 text-sm font-semibold transition-colors cursor-pointer ${
              activeTab === 'alterar'
                ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            <CheckSquare size={16} /> Alterar Status
          </button>
          <button
            onClick={() => setActiveTab('historico')}
            className={`flex items-center gap-2 px-4 py-3.5 border-b-2 text-sm font-semibold transition-colors cursor-pointer ${
              activeTab === 'historico'
                ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            <History size={16} /> Histórico
          </button>
          <button
            onClick={() => setActiveTab('comentarios')}
            className={`flex items-center gap-2 px-4 py-3.5 border-b-2 text-sm font-semibold transition-colors cursor-pointer ${
              activeTab === 'comentarios'
                ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            <MessageSquare size={16} /> Comentários & Arquivos
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-white dark:bg-gray-900">
          {activeTab === 'alterar' && (
            <form onSubmit={handleSaveAlteration} className="space-y-5">
              {/* Dropdowns */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
                    Status Principal
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as StatusType)}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-hidden transition-shadow"
                  >
                    <option className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white" value="Falta XML">Falta XML</option>
                    <option className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white" value="Não iniciado">Não iniciado</option>
                    {(task.obligationCode === 'SIOPE' || task.obligationCode === 'SIOPS') && (
                      <option className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white" value="Pendência Cliente">Pendência Cliente</option>
                    )}
                    <option className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white" value="Trabalhando">Trabalhando</option>
                    <option className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white" value="Retificar">Retificar</option>
                    <option className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white" value="Enviado">Enviado</option>
                    <option className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white" value="Homologado">Homologado</option>
                  </select>
                </div>

                {/* SIOPS Members */}
                {task.obligationCode === 'SIOPS' && (
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
                      Controle de Membros (SIOPS)
                    </label>
                    <select
                      value={siopsMembros}
                      onChange={(e) => setSiopsMembros(e.target.value as SIOPSMembrosType)}
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-hidden transition-shadow"
                    >
                      <option className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white" value="Não Solicitado">Não Solicitado</option>
                      <option className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white" value="Solicitado">Solicitado</option>
                      <option className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white" value="Recebido">Recebido</option>
                      <option className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white" value="Importado">Importado</option>
                      <option className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white" value="Críticas">Críticas</option>
                      <option className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white" value="Diferença Folha">Diferença Folha</option>
                      <option className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white" value="Sem críticas">Sem críticas</option>
                    </select>
                  </div>
                )}

                {/* SIOPE Folha */}
                {task.obligationCode === 'SIOPE' && (
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
                      Controle de Folha (SIOPE)
                    </label>
                    <select
                      value={siopeFolha}
                      onChange={(e) => setSiopeFolha(e.target.value as SIOPEFolhaType)}
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-hidden transition-shadow"
                    >
                      <option className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white" value="Não Solicitado">Não Solicitado</option>
                      <option className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white" value="Solicitado">Solicitado</option>
                      <option className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white" value="Recebido">Recebido</option>
                      <option className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white" value="Importado">Importado</option>
                      <option className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white" value="Críticas">Críticas</option>
                      <option className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white" value="Diferença Folha">Diferença Folha</option>
                      <option className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white" value="Sem críticas">Sem críticas</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Janela de Alteração Triggered block */}
              {hasChanges && (
                <div className="p-5 border border-amber-200 dark:border-amber-900 bg-amber-50/35 dark:bg-amber-950/25 rounded-xl space-y-4 animate-scale-in">
                  <h4 className="text-sm font-bold text-amber-800 dark:text-amber-400 flex items-center gap-2">
                    <Clock size={16} /> Confirmação de Alteração Histórica
                  </h4>
                  <p className="text-xs text-amber-700/80 dark:text-amber-300/80">
                    Você modificou um dos campos principais. Forneça suas informações para registrar essa mudança no histórico inalterável da tarefa.
                  </p>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-amber-800/80 dark:text-amber-400/85 mb-1">
                        Seu Nome *
                      </label>
                      <select
                        value={changeName}
                        onChange={(e) => setChangeName(e.target.value)}
                        className="w-full px-3 py-2 border border-amber-200 dark:border-amber-900 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 cursor-pointer"
                      >
                        <option value="">- Selecione seu nome -</option>
                        {employees.map((emp) => (
                          <option key={emp} value={emp}>{emp}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-amber-800/80 dark:text-amber-400/85 mb-1">
                        Observação / Justificativa (Opcional)
                      </label>
                      <textarea
                        value={changeObservation}
                        onChange={(e) => setChangeObservation(e.target.value)}
                        placeholder="Ex: Cliente enviou XML de retificação"
                        rows={3}
                        className="w-full px-3 py-2 border border-amber-200 dark:border-amber-900 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 resize-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold rounded-lg cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!hasChanges || isSaving}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:text-gray-400 text-white font-semibold rounded-lg inline-flex items-center gap-2 cursor-pointer transition-colors"
                >
                  {isSaving ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> Salvando...
                    </>
                  ) : (
                    'Salvar Alteração'
                  )}
                </button>
              </div>
            </form>
          )}

          {activeTab === 'historico' && (
            <div className="space-y-4">
              {loadingHistory ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="animate-spin text-blue-500" size={32} />
                </div>
              ) : historyList.length === 0 ? (
                <div className="p-12 border border-dashed border-gray-200 dark:border-gray-700 rounded-xl text-center">
                  <p className="text-gray-500 dark:text-gray-400 text-sm">Nenhuma alteração registrada ainda nesta tarefa.</p>
                </div>
              ) : (
                <div className="border border-gray-100 dark:border-gray-700 rounded-xl overflow-x-auto shadow-xs">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-50 dark:bg-gray-800">
                      <tr>
                        <th className="px-4 py-2.5 text-xs font-bold text-gray-500 dark:text-gray-400">Data/Hora</th>
                        <th className="px-4 py-2.5 text-xs font-bold text-gray-500 dark:text-gray-400">Campo</th>
                        <th className="px-4 py-2.5 text-xs font-bold text-gray-500 dark:text-gray-400">De</th>
                        <th className="px-4 py-2.5 text-xs font-bold text-gray-500 dark:text-gray-400">Para</th>
                        <th className="px-4 py-2.5 text-xs font-bold text-gray-500 dark:text-gray-400">Responsável</th>
                        <th className="px-4 py-2.5 text-xs font-bold text-gray-500 dark:text-gray-400">Observação</th>
                        <th className="px-4 py-2.5 text-xs font-bold text-gray-500 dark:text-gray-400 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700 text-xs text-gray-700 dark:text-gray-300">
                      {historyList.map((h) => {
                        const dt = formatDateTime(h.createdAt);
                        const isEditing = editingHistoryId === h.id;
                        return (
                          <tr key={h.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/40">
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className="font-semibold block">{dt.date}</span>
                              <span className="text-gray-400 dark:text-gray-500">{dt.time}</span>
                            </td>
                            <td className="px-4 py-3 capitalize font-semibold text-gray-900 dark:text-white">
                              {h.fieldChanged === 'siopsMembros' ? 'Membros (SIOPS)' : h.fieldChanged === 'siopeFolha' ? 'Folha (SIOPE)' : 'Status'}
                            </td>
                            <td className="px-4 py-3">
                              {isEditing ? (
                                <select
                                  value={editOldValue}
                                  onChange={(e) => setEditOldValue(e.target.value)}
                                  className="w-full text-xs p-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white"
                                >
                                  <option value="">Vazio / Nenhum</option>
                                  {getOptionsForField(h.fieldChanged).map((opt) => (
                                    <option key={opt} value={opt}>{opt}</option>
                                  ))}
                                </select>
                              ) : (
                                <span className="px-2 py-0.5 rounded-sm bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                                  {h.oldValue || 'Vazio'}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {isEditing ? (
                                <select
                                  value={editNewValue}
                                  onChange={(e) => setEditNewValue(e.target.value)}
                                  className="w-full text-xs p-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white"
                                >
                                  <option value="">Vazio / Nenhum</option>
                                  {getOptionsForField(h.fieldChanged).map((opt) => (
                                    <option key={opt} value={opt}>{opt}</option>
                                  ))}
                                </select>
                              ) : (
                                <span className="px-2 py-0.5 rounded-sm bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 font-bold border border-blue-100 dark:border-blue-900/50">
                                  {h.newValue || 'Vazio'}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 min-w-[150px]">
                              {isEditing ? (
                                <div className="space-y-1">
                                  {!customUserActive ? (
                                    <select
                                      value={editUserWhoChanged}
                                      onChange={(e) => {
                                        if (e.target.value === '__custom__') {
                                          setCustomUserActive(true);
                                          setEditUserWhoChanged('');
                                        } else {
                                          setEditUserWhoChanged(e.target.value);
                                        }
                                      }}
                                      className="w-full text-xs p-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white"
                                    >
                                      <option value="">- Selecione -</option>
                                      {employees.map((emp) => (
                                        <option key={emp} value={emp}>{emp}</option>
                                      ))}
                                      {/* If current value is not in employees and not empty, list it */}
                                      {editUserWhoChanged && !employees.includes(editUserWhoChanged) && (
                                        <option value={editUserWhoChanged}>{editUserWhoChanged}</option>
                                      )}
                                      <option value="__custom__">Digitar outro...</option>
                                    </select>
                                  ) : (
                                    <div className="flex gap-1 items-center">
                                      <input
                                        type="text"
                                        value={editUserWhoChanged}
                                        onChange={(e) => setEditUserWhoChanged(e.target.value)}
                                        className="w-full text-xs p-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white"
                                        placeholder="Digitar nome..."
                                        autoFocus
                                      />
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setCustomUserActive(false);
                                          setEditUserWhoChanged('');
                                        }}
                                        className="text-[10px] px-1.5 py-1 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded text-gray-600 dark:text-gray-300"
                                        title="Voltar para lista"
                                      >
                                        Lista
                                      </button>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="font-semibold text-gray-900 dark:text-white">{h.userWhoChanged || '-'}</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {isEditing ? (
                                <textarea
                                  value={editObservation}
                                  onChange={(e) => setEditObservation(e.target.value)}
                                  className="w-full text-xs p-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white"
                                  rows={1}
                                  placeholder="Observação"
                                />
                              ) : (
                                <span className="italic block max-w-xs truncate" title={h.observation || undefined}>
                                  {h.observation || '-'}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right whitespace-nowrap">
                              {isEditing ? (
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    disabled={isSavingHistory}
                                    onClick={() => handleSaveHistory(h.id)}
                                    className="p-1 bg-green-50 hover:bg-green-100 dark:bg-green-900/20 dark:hover:bg-green-900/40 rounded text-green-600 dark:text-green-400 transition-colors"
                                    title="Salvar"
                                  >
                                    {isSavingHistory ? <Loader2 className="animate-spin" size={14} /> : <Check size={14} />}
                                  </button>
                                  <button
                                    disabled={isSavingHistory}
                                    onClick={handleCancelEditHistory}
                                    className="p-1 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 rounded text-red-600 dark:text-red-400 transition-colors"
                                    title="Cancelar"
                                  >
                                    <X size={14} />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => handleStartEditHistory(h)}
                                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-500 hover:text-blue-600 dark:text-gray-400 transition-colors"
                                  title="Editar histórico"
                                >
                                  <Edit2 size={14} />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'comentarios' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full">
              {/* Left Column: Comments */}
              <div className="flex flex-col h-[400px]">
                <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-1.5">
                  <MessageSquare size={16} /> Comentários
                </h4>

                {/* Comments List */}
                <div className="flex-1 overflow-y-auto border border-gray-100 dark:border-gray-700/85 rounded-xl p-4 bg-gray-50/30 dark:bg-gray-900/35 space-y-4 mb-4 min-h-0">
                  {loadingComments ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="animate-spin text-blue-500" />
                    </div>
                  ) : commentsList.length === 0 ? (
                    <p className="text-gray-400 text-xs italic text-center py-6">Nenhum comentário nesta tarefa.</p>
                  ) : (
                    commentsList.map((c) => {
                      const dt = formatDateTime(c.createdAt);
                      return (
                        <div key={c.id} className="p-3 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl space-y-1 shadow-2xs">
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="font-bold text-gray-900 dark:text-white">{c.authorName}</span>
                            <span className="text-gray-400">{dt.date} às {dt.time}</span>
                          </div>
                          <p className="text-xs text-gray-700 dark:text-gray-300 break-words">{c.text}</p>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Comment Form */}
                <form onSubmit={handleAddComment} className="space-y-2">
                  <div className="flex gap-2">
                    <select
                      value={commentAuthor}
                      onChange={(e) => setCommentAuthor(e.target.value)}
                      className="w-1/3 px-2.5 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-hidden focus:ring-1 focus:ring-blue-500 cursor-pointer"
                    >
                      <option value="">Seu nome</option>
                      {employees.map((emp) => (
                        <option key={emp} value={emp}>{emp}</option>
                      ))}
                    </select>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        required
                        placeholder="Escreva um comentário..."
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        className="w-full pl-3 pr-10 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-hidden focus:ring-1 focus:ring-blue-500"
                      />
                      <button
                        type="submit"
                        disabled={isSavingComment || !newComment.trim()}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 text-blue-600 hover:text-blue-700 disabled:text-gray-300 rounded-md cursor-pointer transition-colors"
                      >
                        {isSavingComment ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                      </button>
                    </div>
                  </div>
                </form>
              </div>

              {/* Right Column: Attachments */}
              <div className="flex flex-col h-[400px]">
                <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-1.5">
                  <Paperclip size={16} /> Anexos da Tarefa
                </h4>

                {/* Drag and drop upload zone */}
                <label className="border-2 border-dashed border-gray-200 dark:border-gray-700 hover:border-blue-500/50 hover:bg-blue-50/5 dark:hover:bg-blue-950/5 rounded-xl p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-colors mb-4 shrink-0">
                  <input
                    type="file"
                    className="hidden"
                    onChange={handleFileUpload}
                    disabled={uploadingFile}
                    accept=".xml,.pdf,.xlsx,.xls,.doc,.docx,.zip,image/*"
                  />
                  {uploadingFile ? (
                    <Loader2 className="animate-spin text-blue-500 mb-1" size={24} />
                  ) : (
                    <Paperclip className="text-gray-400 mb-1" size={24} />
                  )}
                  <span className="text-xs font-bold text-gray-700 dark:text-gray-300 block">Enviar Arquivo</span>
                  <span className="text-[10px] text-gray-400">XML, PDF, Excel, Word, ZIP, Imagens (Máx 10MB)</span>
                </label>

                {/* Attachments list */}
                <div className="flex-1 overflow-y-auto border border-gray-100 dark:border-gray-700 rounded-xl p-4 bg-gray-50/30 dark:bg-gray-900/35 space-y-2 min-h-0">
                  {loadingAttachments ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="animate-spin text-blue-500" />
                    </div>
                  ) : attachmentsList.length === 0 ? (
                    <p className="text-gray-400 text-xs italic text-center py-6">Nenhum anexo nesta tarefa.</p>
                  ) : (
                    attachmentsList.map((att) => {
                      const dt = formatDateTime(att.uploadedAt);
                      const sizeInKB = Math.round(att.fileSize / 1024);
                      return (
                        <div
                          key={att.id}
                          className="flex items-center justify-between p-2.5 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg group shadow-2xs text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <FileCode size={16} className="text-blue-500 shrink-0" />
                            <div className="min-w-0">
                              <p className="font-semibold text-gray-900 dark:text-white truncate" title={att.fileName}>
                                {att.fileName}
                              </p>
                              <p className="text-[10px] text-gray-400 mt-0.5">
                                {sizeInKB} KB • {dt.date}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => handleDownloadFile(att)}
                            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md cursor-pointer transition-colors"
                            title="Baixar Arquivo"
                          >
                            <Download size={14} />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
export default CellEditModal;
