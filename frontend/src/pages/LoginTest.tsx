import { useState } from 'react';
import api, { API_BASE_URL } from '@/lib/api';

export function LoginTest() {
  const [email, setEmail] = useState('admin@crm.local');
  const [password, setPassword] = useState('password123');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState('');

  const handleTest = async () => {
    try {
      setStatus('loading');
      setError('');
      setResult(null);

      const response = await api.post('/auth/login', { email, password });
      setStatus('success');
      setResult(response.data);
    } catch (err: unknown) {
      setStatus('error');

      if (
        typeof err === 'object' &&
        err !== null &&
        'response' in err &&
        typeof err.response === 'object' &&
        err.response !== null &&
        'data' in err.response
      ) {
        const responseData = err.response.data;
        const message =
          typeof responseData === 'object' &&
          responseData !== null &&
          'message' in responseData &&
          typeof responseData.message === 'string'
            ? responseData.message
            : 'Erreur inconnue';
        setError(message);
        setResult(responseData);
        return;
      }

      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    }
  };

  return (
    <div style={{ maxWidth: 500, margin: '50px auto', padding: 20, fontFamily: 'Arial' }}>
      <h1>Test de connexion Frontend / Backend</h1>

      <div style={{ marginBottom: 20, padding: 15, backgroundColor: '#f0f0f0', borderRadius: 8 }}>
        <p><strong>Backend URL:</strong> {API_BASE_URL}</p>
        <p><strong>Frontend URL:</strong> {window.location.origin}</p>
        <p>
          <strong>Status:</strong>{' '}
          {status === 'idle'
            ? 'Pret'
            : status === 'loading'
              ? 'Chargement...'
              : status === 'success'
                ? 'Succes'
                : 'Erreur'}
        </p>
      </div>

      <div style={{ marginBottom: 15 }}>
        <label>
          Email:
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={status === 'loading'}
            style={{ display: 'block', width: '100%', marginTop: 5, padding: 8 }}
          />
        </label>
      </div>

      <div style={{ marginBottom: 15 }}>
        <label>
          Password:
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={status === 'loading'}
            style={{ display: 'block', width: '100%', marginTop: 5, padding: 8 }}
          />
        </label>
      </div>

      <button
        onClick={handleTest}
        disabled={status === 'loading'}
        style={{
          width: '100%',
          padding: 12,
          backgroundColor: status === 'loading' ? '#ccc' : '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: 4,
          cursor: status === 'loading' ? 'not-allowed' : 'pointer',
          fontSize: 16,
          fontWeight: 'bold',
        }}
      >
        {status === 'loading' ? 'Connexion...' : 'Tester la connexion'}
      </button>

      {error && (
        <div style={{ marginTop: 15, padding: 10, backgroundColor: '#ffe6e6', borderRadius: 4, color: '#d32f2f' }}>
          <strong>Erreur:</strong> {error}
        </div>
      )}

      {result !== null && (
        <div style={{ marginTop: 15, padding: 10, backgroundColor: '#e6ffe6', borderRadius: 4, color: '#1b5e20' }}>
          <strong>Reponse du serveur:</strong>
          <pre style={{ marginTop: 10, overflow: 'auto' }}>{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
