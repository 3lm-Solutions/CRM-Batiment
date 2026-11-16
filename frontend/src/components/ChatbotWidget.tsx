import { useEffect, useRef, useState, type FormEvent } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  Bot,
  Building2,
  Loader2,
  MessageCircle,
  MinusCircle,
  RotateCcw,
  Send,
  Sparkles,
  User,
  X,
  Copy,
  ThumbsUp,
  ThumbsDown,
  BarChart3,
  FileText,
  HardHat,
  Users,
  Search,
  Zap,
  Shield,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import './ChatbotWidget.css';
import { validateChatInput } from './chatValidation';
/* ============================================================
   TYPES
   ============================================================ */

interface ChatMessage {
  id: string;
  role: 'USER' | 'ASSISTANT';
  content: string;
  timestamp: Date;
  projectTypes?: Array<{
    id: number;
    nom: string;
    description: string | null;
  }>;
  checklist?: string[];
  structuredWorkflow?: {
    status: string;
    project_type: string;
    categories: Array<{ id: number; nom: string; description: string | null }>;
    sous_categories: Array<{ id: number; nom: string; description: string | null }>;
    prestations: Array<{
      id: number;
      nom: string;
      description: string | null;
      prixVenteMin: number;
      prixVenteMax: number;
      options: Array<{
        id: number;
        nom: string;
        obligatoire: boolean;
        choix: Array<{ id: number; nom: string; impactPrix: number }>;
      }>;
    }>;
  };
}

interface AssistantApiResult {
  intent: string;
  project_type: string;
  is_known_project: boolean;
  missing_fields: string[];
  project_types?: Array<{
    id: number;
    nom: string;
    description: string | null;
  }>;
  collected_data: {
    nom: string;
    telephone: string;
    email: string;
    description: string;
  };
  response_message: string;
  checklist?: string[];
  structured_workflow?: ChatMessage['structuredWorkflow'];
}

interface QuickSuggestion {
  label: string;
  message: string;
  icon: React.ReactNode;
}

/* ============================================================
   SUGGESTIONS BY ROLE (Internal Mode)
   ============================================================ */

const publicSuggestions: QuickSuggestion[] = [
  { label: 'Demander un devis', message: 'Je souhaite demander un devis pour des travaux', icon: <FileText size={12} /> },
  { label: 'Prendre rendez-vous', message: 'Je voudrais prendre un rendez-vous', icon: <Users size={12} /> },
  { label: 'Suivre ma demande', message: 'Je veux suivre ma demande', icon: <Search size={12} /> },
  { label: 'Nos services', message: 'Quels sont les services disponibles ?', icon: <HardHat size={12} /> },
  { label: 'Questions fréquentes', message: 'Quelle est la différence entre un devis et une facture ?', icon: <Zap size={12} /> },
];

const internalSuggestionsByRole: Record<string, QuickSuggestion[]> = {
  ADMIN: [
    { label: 'Résumé activité', message: 'Donne-moi un résumé de l\'activité de l\'entreprise', icon: <BarChart3 size={12} /> },
    { label: 'Créer un devis', message: 'Je veux créer un nouveau devis pour un client', icon: <FileText size={12} /> },
    { label: 'Gérer utilisateurs', message: 'Comment gérer les utilisateurs et leurs rôles ?', icon: <Shield size={12} /> },
    { label: 'Voir les chantiers', message: 'Montre-moi l\'état de mes chantiers en cours', icon: <HardHat size={12} /> },
  ],
  TECHNICO: [
    { label: 'Mes devis', message: 'Quels sont mes devis en attente ?', icon: <FileText size={12} /> },
    { label: 'Nouveau client', message: 'Je veux ajouter un nouveau client', icon: <Users size={12} /> },
    { label: 'Catalogue prix', message: 'Montre-moi le catalogue des prestations', icon: <Search size={12} /> },
    { label: 'Aide rapide', message: 'Comment fonctionne le processus de devis ?', icon: <Zap size={12} /> },
  ],
  ASSISTANTE: [
    { label: 'Demandes en cours', message: 'Quelles sont les demandes de devis en cours ?', icon: <FileText size={12} /> },
    { label: 'Clients récents', message: 'Montre-moi les derniers clients ajoutés', icon: <Users size={12} /> },
    { label: 'Factures', message: 'Y a-t-il des factures en attente ?', icon: <BarChart3 size={12} /> },
    { label: 'Aide navigation', message: 'Comment accéder au module fournisseurs ?', icon: <Search size={12} /> },
  ],
  CHEF_CHANTIER: [
    { label: 'Mes chantiers', message: 'Quels sont mes chantiers en cours ?', icon: <HardHat size={12} /> },
    { label: 'Tâches à faire', message: 'Quelles sont mes tâches prioritaires ?', icon: <Sparkles size={12} /> },
    { label: 'Réceptions', message: 'Y a-t-il des réceptions prévues ?', icon: <Building2 size={12} /> },
  ],
  SOUS_TRAITANT: [
    { label: 'Mes commandes', message: 'Quelles sont mes commandes en cours ?', icon: <FileText size={12} /> },
    { label: 'Aide', message: 'Comment fonctionne le portail fournisseur ?', icon: <Search size={12} /> },
  ],
};

/* ============================================================
   HELPERS
   ============================================================ */

function generateMsgId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function getApiErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const err = error as { response?: { data?: { message?: string | string[] } } };
    const msg = err.response?.data?.message;
    if (Array.isArray(msg)) return msg.join(', ');
    if (typeof msg === 'string' && msg.trim().length > 0) return msg;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}

/* ============================================================
   COMPONENT
   ============================================================ */

export default function ChatbotWidget() {
  const { user, isAuthenticated } = useAuth();

  /* ---------- State ---------- */
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStarting, setIsStarting] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [feedbackGiven, setFeedbackGiven] = useState<Record<string, 'UP' | 'DOWN'>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /* ---------- Derived ---------- */
  const isInternal = isAuthenticated && !!user;
  const mode = isInternal ? 'internal' : 'public';
  const isBusy = isStarting || isSending;
  const canSend = !!sessionId && input.trim().length > 0 && !isBusy;

  const suggestions = isInternal
    ? internalSuggestionsByRole[user?.role ?? 'ADMIN'] ?? publicSuggestions
    : publicSuggestions;

  const userInitials = user
    ? `${user.prenom?.charAt(0) ?? ''}${user.nom?.charAt(0) ?? ''}`.toUpperCase() || 'U'
    : 'V';

  /* ---------- Auto-scroll ---------- */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  /* ---------- Focus input when panel opens ---------- */
  useEffect(() => {
    if (isOpen && !isMinimized) {
      setTimeout(() => inputRef.current?.focus(), 350);
    }
  }, [isOpen, isMinimized]);

  /* ---------- API Calls ---------- */
  async function initSession(forceRestart = false) {
    if (sessionId && !forceRestart) return;

    setError('');
    setIsStarting(true);

    try {
      const res = await api.post('/assistant/session/start', {
        companyId: 1,
      });

      setSessionId(res.data.session_id as number);
      setShowSuggestions(true);

      const welcomeContent = isInternal
        ? `Bonjour ${user?.prenom ?? ''} 👋\nJe suis votre assistant BatiCRM. Je peux vous aider à naviguer, obtenir des informations ou effectuer des actions rapides.\n\nQue puis-je faire pour vous ?`
        : (res.data.response_message as string) ||
          'Bonjour ! 👋 Je suis Léa, votre assistante BatiCRM. Je peux vous aider pour un devis, un rendez-vous, le suivi de votre demande, ou répondre à vos questions. Comment puis-je vous aider ?';

      setMessages([
        {
          id: generateMsgId(),
          role: 'ASSISTANT',
          content: welcomeContent,
          timestamp: new Date(),
        },
      ]);
      setInput('');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Impossible de démarrer le chatbot.'));
    } finally {
      setIsStarting(false);
    }
  }

  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    if (!canSend) return;
    const validation = validateChatInput(input);
    if (!validation.valid) {
      setError(validation.message ?? 'Message invalide.');
      return;
    }
    const userMessage = input.trim();
    setInput('');
    setError('');
    setIsSending(true);
    setShowSuggestions(false);

    const userMsg: ChatMessage = {
      id: generateMsgId(),
      role: 'USER',
      content: userMessage,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const res = await api.post<AssistantApiResult>(
        `/assistant/session/${sessionId}/message`,
        {
          companyId: 1,
          message: userMessage,
        },
      );

      const assistantMsg: ChatMessage = {
        id: generateMsgId(),
        role: 'ASSISTANT',
        content: res.data.response_message,
        timestamp: new Date(),
        projectTypes: res.data.project_types,
        checklist: res.data.checklist,
        structuredWorkflow: res.data.structured_workflow,
      };
      setMessages((prev) => [...prev, assistantMsg]);
      // Si le bot propose les choix principaux, on reaffiche les suggestions cliquables
      if (res.data.response_message?.includes('Que souhaitez-vous faire')) {
        setShowSuggestions(true);
      }
    } catch (err) {
      setError(getApiErrorMessage(err, 'Echec d\'envoi. Veuillez réessayer.'));
    } finally {
      setIsSending(false);
    }
  }

  function handleSuggestionClick(suggestion: QuickSuggestion) {
    setInput(suggestion.message);
    setShowSuggestions(false);

    // Auto-send the suggestion
    if (sessionId && !isBusy) {
      setInput('');
      setError('');
      setIsSending(true);

      const userMsg: ChatMessage = {
        id: generateMsgId(),
        role: 'USER',
        content: suggestion.message,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMsg]);

      api
        .post<AssistantApiResult>(
          `/assistant/session/${sessionId}/message`,
          {
            companyId: 1,
            message: suggestion.message,
          },
        )
        .then((res) => {
          const assistantMsg: ChatMessage = {
            id: generateMsgId(),
            role: 'ASSISTANT',
            content: res.data.response_message,
            timestamp: new Date(),
            projectTypes: res.data.project_types,
            checklist: res.data.checklist,
            structuredWorkflow: res.data.structured_workflow,
          };
          setMessages((prev) => [...prev, assistantMsg]);
          // Si le bot propose les choix principaux, on reaffiche les suggestions cliquables
          if (res.data.response_message?.includes('Que souhaitez-vous faire')) {
            setShowSuggestions(true);
          }
        })
        .catch((err) => {
          setError(getApiErrorMessage(err, 'Echec d\'envoi.'));
          setMessages((prev) => [
            ...prev,
            {
              id: generateMsgId(),
              role: 'ASSISTANT',
              content: 'Désolée, une erreur est survenue. Pouvez-vous réessayer ? 🙏',
              timestamp: new Date(),
            },
          ]);
        })
        .finally(() => {
          setIsSending(false);
        });
    }
  }

  function handleWorkflowChoice(choiceLabel: string) {
    if (!sessionId || isBusy) return;

    setInput('');
    setError('');
    setIsSending(true);
    setShowSuggestions(false);

    const userMsg: ChatMessage = {
      id: generateMsgId(),
      role: 'USER',
      content: choiceLabel,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);

    api
      .post<AssistantApiResult>(
        `/assistant/session/${sessionId}/message`,
        {
          companyId: 1,
          message: choiceLabel,
        },
      )
      .then((res) => {
        const assistantMsg: ChatMessage = {
          id: generateMsgId(),
          role: 'ASSISTANT',
          content: res.data.response_message,
          timestamp: new Date(),
          projectTypes: res.data.project_types,
          checklist: res.data.checklist,
          structuredWorkflow: res.data.structured_workflow,
        };
        setMessages((prev) => [...prev, assistantMsg]);
      })
      .catch((err) => {
        setError(getApiErrorMessage(err, 'Echec d\'envoi.'));
      })
      .finally(() => {
        setIsSending(false);
      });
  }

  async function handleOpen() {
    setIsOpen(true);
    setIsMinimized(false);
    await initSession(false);
  }
  function handleCopy(content: string) {
    void navigator.clipboard.writeText(content);
  }

  function handleFeedback(msg: ChatMessage, rating: 'UP' | 'DOWN') {
    // On memorise le vote pour colorer le bouton (et eviter le double vote)
    setFeedbackGiven((prev) => ({ ...prev, [msg.id]: rating }));
    api
      .post('/assistant/feedback', {
        companyId: 1,
        sessionId: sessionId ?? undefined,
        messageExcerpt: msg.content.slice(0, 300),
        rating,
      })
      .catch(() => {
        // Silencieux : un echec de feedback ne doit jamais gener le client
      });
  }
  async function handleReset() {
    const confirmed = window.confirm(
      'Commencer une nouvelle conversation ? La conversation actuelle sera effacée.',
    );
    if (confirmed) await initSession(true);
  }

  function handleClose() {
    setIsOpen(false);
    setIsMinimized(false);
  }

  /* ---------- Render ---------- */
  return (
    <>
      {/* ===== Floating Action Button ===== */}
      {!isOpen && (
        <button
          type="button"
          className="chatbot-fab"
          onClick={() => void handleOpen()}
          id="chatbot-open-btn"
        >
          <span className="chatbot-fab-icon-wrap">
            <span className="chatbot-fab-ping" />
            <MessageCircle size={17} />
          </span>
          <span className="chatbot-fab-label">
            <span className="chatbot-fab-label-sub">
              {isInternal ? 'Assistant IA' : 'Besoin d\'aide ?'}
            </span>
            <span>
              {isInternal ? 'Aide & Actions' : 'Démarrer le chat'}
            </span>
          </span>
        </button>
      )}

      {/* ===== Chat Panel ===== */}
      {isOpen && !isMinimized && (
        <div className="chatbot-panel" id="chatbot-panel">
          {/* Header */}
          <div className="chatbot-header">
            <div className="chatbot-header-left">
              <div className="chatbot-header-avatar">
                <span style={{ fontWeight: 700, fontSize: '15px' }}>L</span>
              </div>
              <div className="chatbot-header-info">
                <h3>
                  Léa · Assistant BatiCRM
                </h3>
                <div className="chatbot-header-status">
                  <span className="chatbot-status-dot" />
                  <span>En ligne</span>
                  <span style={{ margin: '0 0.25rem' }}>•</span>
                  <span className={`chatbot-mode-badge chatbot-mode-badge--${mode}`}>
                    {isInternal ? '🔒 Interne' : '🌐 Public'}
                  </span>
                </div>
              </div>
            </div>

            <div className="chatbot-header-actions">
              <button
                type="button"
                className="chatbot-header-btn"
                onClick={() => void handleReset()}
                title="Nouvelle conversation"
              >
                <RotateCcw size={15} />
              </button>
              <button
                type="button"
                className="chatbot-header-btn"
                onClick={() => setIsMinimized(true)}
                title="Réduire"
              >
                <MinusCircle size={15} />
              </button>
              <button
                type="button"
                className="chatbot-header-btn"
                onClick={handleClose}
                title="Fermer"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="chatbot-messages">
            {messages.length === 0 && !isStarting && (
              <div className="chatbot-welcome">
                <div className="chatbot-welcome-icon">
                  <Sparkles size={24} />
                </div>
                <h4>
                  {isInternal
                    ? `Bienvenue, ${user?.prenom ?? 'utilisateur'} !`
                    : 'Bienvenue sur BatiCRM'}
                </h4>
                <p>
                  {isInternal
                    ? 'Votre assistant IA est prêt à vous aider dans vos tâches quotidiennes.'
                    : 'Notre assistant IA va vous guider pour votre projet de construction.'}
                </p>
              </div>
            )}

            {isStarting && messages.length === 0 && (
              <div className="chatbot-typing">
                <div className="chatbot-msg-avatar chatbot-msg-avatar--bot">
                  <Bot size={13} />
                </div>
                <div className="chatbot-typing-dots">
                  <span className="chatbot-typing-dot" />
                  <span className="chatbot-typing-dot" />
                  <span className="chatbot-typing-dot" />
                </div>
              </div>
            )}

            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`chatbot-msg chatbot-msg--${msg.role === 'USER' ? 'user' : 'assistant'}`}
              >
                <div
                  className={`chatbot-msg-avatar ${
                    msg.role === 'USER'
                      ? 'chatbot-msg-avatar--user'
                      : 'chatbot-msg-avatar--bot'
                  }`}
                >
                  {msg.role === 'USER' ? (
                    isInternal ? userInitials : <User size={13} />
                  ) : (
                    <Bot size={13} />
                  )}
                </div>
                <div>
                  <div className="chatbot-msg-bubble">
                    {msg.role === 'USER' ? (
                      msg.content
                    ) : (
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    )}

                    {/* Project Types */}
                    {msg.projectTypes && msg.projectTypes.length > 0 && (
                      <div className="chatbot-project-types">
                        {msg.projectTypes.map((pt) => (
                          <div key={pt.id} className="chatbot-project-type-item">
                            <span className="chatbot-project-type-icon">
                              <Building2 size={11} />
                            </span>
                            <div>
                              <div className="chatbot-project-type-name">{pt.nom}</div>
                              {pt.description && (
                                <div className="chatbot-project-type-desc">{pt.description}</div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {msg.structuredWorkflow && (
                      <div className="chatbot-workflow">
                        {msg.structuredWorkflow.categories.length > 0 && (
                          <div className="chatbot-workflow-block">
                            <div className="chatbot-workflow-title">Categories</div>
                            <div className="chatbot-choice-list">
                              {msg.structuredWorkflow.categories.slice(0, 8).map((item) => (
                                <button
                                  key={`cat-${item.id}`}
                                  type="button"
                                  className="chatbot-choice-btn"
                                  onClick={() => handleWorkflowChoice(item.nom)}
                                  disabled={isBusy}
                                >
                                  {item.nom}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {msg.structuredWorkflow.sous_categories.length > 0 && (
                          <div className="chatbot-workflow-block">
                            <div className="chatbot-workflow-title">Sous-categories</div>
                            <div className="chatbot-choice-list">
                              {msg.structuredWorkflow.sous_categories.slice(0, 8).map((item) => (
                                <button
                                  key={`sub-${item.id}`}
                                  type="button"
                                  className="chatbot-choice-btn"
                                  onClick={() => handleWorkflowChoice(item.nom)}
                                  disabled={isBusy}
                                >
                                  {item.nom}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                      </div>
                    )}

                  </div>
                  {msg.role === 'ASSISTANT' && (
                    <div className="chatbot-msg-actions">
                      <button
                        type="button"
                        onClick={() => handleCopy(msg.content)}
                        title="Copier la réponse"
                      >
                        <Copy size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleFeedback(msg, 'UP')}
                        className={feedbackGiven[msg.id] === 'UP' ? 'is-active-up' : ''}
                        title="Réponse utile"
                      >
                        <ThumbsUp size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleFeedback(msg, 'DOWN')}
                        className={feedbackGiven[msg.id] === 'DOWN' ? 'is-active-down' : ''}
                        title="Réponse pas utile"
                      >
                        <ThumbsDown size={13} />
                      </button>
                    </div>
                  )}
                  <div className="chatbot-msg-time">{formatTime(msg.timestamp)}</div>
                </div>
              </div>
            ))}

            {/* Typing Indicator */}
            {isSending && (
              <div className="chatbot-typing">
                <div className="chatbot-msg-avatar chatbot-msg-avatar--bot">
                  <Bot size={13} />
                </div>
                <div className="chatbot-typing-dots">
                  <span className="chatbot-typing-dot" />
                  <span className="chatbot-typing-dot" />
                  <span className="chatbot-typing-dot" />
                </div>
              </div>
            )}

            {/* Error */}
            {error && <div className="chatbot-error">{error}</div>}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Suggestions */}
          {showSuggestions && messages.length > 0 && !isBusy && (
            <div className="chatbot-suggestions">
              {suggestions.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  className="chatbot-suggestion-btn"
                  onClick={() => handleSuggestionClick(s)}
                >
                  {s.icon}
                  {s.label}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <form className="chatbot-input-area" onSubmit={(e) => void sendMessage(e)}>
            <input
              ref={inputRef}
              type="text"
              className="chatbot-input"
              placeholder={
                isInternal
                  ? 'Posez une question ou demandez une action...'
                  : 'Décrivez votre projet...'
              }
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isBusy || !sessionId}
              id="chatbot-input-field"
            />
            <button
              type="submit"
              className="chatbot-send-btn"
              disabled={!canSend}
              title="Envoyer"
              id="chatbot-send-btn"
            >
              {isSending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Send size={16} />
              )}
            </button>
          </form>
        </div>
      )}

      {/* ===== Minimized State ===== */}
      {isOpen && isMinimized && (
        <button
          type="button"
          className="chatbot-fab"
          onClick={() => setIsMinimized(false)}
          id="chatbot-restore-btn"
        >
          <span className="chatbot-fab-icon-wrap">
            <Bot size={17} />
          </span>
          <span className="chatbot-fab-label">
            <span className="chatbot-fab-label-sub">
              {messages.length > 1
                ? `${messages.length - 1} message${messages.length > 2 ? 's' : ''}`
                : 'En attente'}
            </span>
            <span>Ouvrir le chat</span>
          </span>
        </button>
      )}
    </>
  );
}
