import React, { useState, useEffect } from 'react';
import { Box, Typography, Paper, Button, TextField } from '@mui/material';
import CenteredLoading from './CenteredLoading';
import { useTheme } from '@mui/material/styles';

const SentMailsView = ({ showSnackbar }) => {
  const theme = useTheme();
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    window.api.readSentEmailsLog?.()
      .then((data) => {
        setEmails(data || []);
        setLoading(false);
      })
      .catch(err => {
        console.error('Hiba az elküldött levelek lekérésekor:', err);
        setLoading(false);
        showSnackbar('Hiba az elküldött levelek lekérésekor', 'error');
      });
  }, []);

  const filteredEmails = emails.filter(email => {
    const q = search.toLowerCase();
    const dateStr = email.date ? new Date(email.date).toISOString().slice(0, 10) : '';
    return (
      (!q) ||
      (email.subject && email.subject.toLowerCase().includes(q)) ||
      (email.to && email.toLowerCase().includes(q)) ||
      (email.body && email.body.toLowerCase().includes(q)) ||
      (dateStr && dateStr.includes(q))
    );
  });

  if (loading) return <CenteredLoading />;

  if (selectedEmail) {
    // Split the body into reply and original message
    let replyText = selectedEmail.body;
    let originalMsg = '';
    const splitMarker = '------- Eredeti üzenet -------';
    if (selectedEmail.body && selectedEmail.body.includes(splitMarker)) {
      const [reply, original] = selectedEmail.body.split(splitMarker);
      replyText = reply.trim();
      originalMsg = splitMarker + original;
    }

    // Ha a logban külön mentve van az eredeti üzenet, azt jelenítsuk meg
    const hasOriginal =
      selectedEmail.originalFrom ||
      selectedEmail.originalDate ||
      selectedEmail.originalSubject ||
      selectedEmail.originalBody;

    return (
      <Paper
        sx={{
          p: 4,
          maxHeight: '84vh', // <-- Itt egyezzen meg a lista nézetével!
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <Typography variant="h5" gutterBottom>Elküldött levél részletei</Typography>
        <Typography><strong>Címzett:</strong> {selectedEmail.to}</Typography>
        <Typography><strong>Tárgy:</strong> {selectedEmail.subject}</Typography>
        <Typography><strong>Dátum:</strong> {selectedEmail.date ? new Date(selectedEmail.date).toISOString().slice(0, 10) : ''}</Typography>
        {replyText && (
          <Typography sx={{ mt: 2, whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}>
            <strong>Válasz szövege:</strong><br />
            <Box
              sx={{
                borderRadius: 1,
                p: 2,
                mt: 1,
                border: '1px solid #333',
                width: '100%',
                boxSizing: 'border-box',
                // maxHeight és overflowY törölve!
              }}
            >
              {replyText}
            </Box>
          </Typography>
        )}
        {(hasOriginal || originalMsg) && (
          <Typography sx={{ mt: 2, whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}>
            <strong>Eredeti üzenet:</strong><br />
            <Box
              sx={{
                maxHeight: 300,
                maxWidth: 900,
                overflowY: 'auto',
                borderRadius: 1,
                p: 2,
                mt: 1,
                border: '1px solid #333',
                width: '100%',
                boxSizing: 'border-box',
                background: '#1a1a1a'
              }}
            >
              {hasOriginal ? (
                <>
                  <div><b>Feladó:</b> {selectedEmail.originalFrom}</div>
                  <div><b>Dátum:</b> {selectedEmail.originalDate}</div>
                  <div><b>Tárgy:</b> {selectedEmail.originalSubject}</div>
                  <div style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}><b>Üzenet:</b><br />{selectedEmail.originalBody}</div>
                </>
              ) : (
                originalMsg
              )}
            </Box>
          </Typography>
        )}
        <Box sx={{ mt: 2 }}>
          <Button variant="outlined" onClick={() => setSelectedEmail(null)}>Vissza</Button>
        </Box>
      </Paper>
    );
  }

  return (
    <Paper sx={{ 
      p: 4,
      maxHeight: '84vh',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      animation: 'fadeIn 0.4s ease forwards',
      '@keyframes fadeIn': {
        from: { opacity: 0, transform: 'translateY(12px)' },
        to: { opacity: 1, transform: 'translateY(0)' },
      },
    }}>
      <Typography 
        variant="h4" 
        gutterBottom
        sx={{
          fontWeight: 700,
          background: 'linear-gradient(135deg, currentColor 0%, rgba(34, 197, 94, 0.8) 100%)',
          backgroundClip: 'text',
          WebkitBackgroundClip: 'text',
        }}
      >
        Elküldött levelek
      </Typography>
      <TextField
        label="Keresés az elküldött levelekben"
        variant="outlined"
        fullWidth
        sx={{ 
          mb: 3,
          '& .MuiOutlinedInput-root': {
            background: 'rgba(34, 197, 94, 0.05)',
            transition: 'all 0.2s ease',
            '&:hover': {
              background: 'rgba(34, 197, 94, 0.08)',
            },
          },
        }}
        value={search}
        onChange={e => setSearch(e.target.value)}
      />
      <Box sx={{ 
        overflowY: 'auto',
        flex: 1,
        pr: 2,
        mr: -2
      }}>
        {filteredEmails.length === 0 ? (
          <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            py: 8,
            opacity: 0.7,
          }}>
            <Typography variant="h6" sx={{ color: 'text.secondary' }}>
              Nincsenek elküldött levelek.
            </Typography>
          </Box>
        ) : (
          filteredEmails.map((email, index) => (
            <Box
              key={email.id}
              sx={{
                mb: 2,
                p: 3,
                background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.05) 0%, rgba(99, 102, 241, 0.02) 100%)',
                border: '1px solid rgba(34, 197, 94, 0.15)',
                borderRadius: 3,
                cursor: 'pointer',
                transition: 'all 0.25s ease',
                animation: 'slideIn 0.3s ease forwards',
                animationDelay: `${index * 0.05}s`,
                opacity: 0,
                '@keyframes slideIn': {
                  from: { opacity: 0, transform: 'translateX(-12px)' },
                  to: { opacity: 1, transform: 'translateX(0)' },
                },
                '&:hover': { 
                  background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.12) 0%, rgba(99, 102, 241, 0.08) 100%)',
                  transform: 'translateX(6px)',
                  boxShadow: '0 4px 20px rgba(34, 197, 94, 0.2)',
                  borderColor: 'rgba(34, 197, 94, 0.3)',
                }
              }}
              onClick={() => setSelectedEmail(email)}
            >
              <Typography sx={{ fontWeight: 600, mb: 0.5 }}><strong>Címzett:</strong> {email.to}</Typography>
              <Typography sx={{ mb: 0.5 }}><strong>Tárgy:</strong> {email.subject}</Typography>
              <Typography sx={{ fontSize: '0.9rem', color: 'text.secondary' }}><strong>Dátum:</strong> {email.date ? new Date(email.date).toISOString().slice(0, 10) : ''}</Typography>
            </Box>
          ))
        )}
      </Box>
    </Paper>
  );
};

export default SentMailsView;