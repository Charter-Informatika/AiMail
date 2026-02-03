import React, { useState, useEffect, useRef } from 'react';
import { Box, Typography, Paper, Button, IconButton, TextField, LinearProgress } from '@mui/material';
import { FaArrowCircleRight } from "react-icons/fa";
import CenteredLoading from './CenteredLoading';

const GeneratedMailsView = ({ showSnackbar }) => {
  const [halfAutoEnabled, setHalfAutoEnabled] = useState(null); 
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generatedReplies, setGeneratedReplies] = useState({});
  const [sending, setSending] = useState(false);
  const [repliesGenerated, setRepliesGenerated] = useState(false);
  const [repliedEmailIds, setRepliedEmailIds] = useState([]); 
  const [savingIds, setSavingIds] = useState([]); 
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [fullEmail, setFullEmail] = useState(null);
  const [loadingFull, setLoadingFull] = useState(false);
  const [search, setSearch] = useState('');
  const [replySubject, setReplySubject] = useState('');
  const [replyBody, setReplyBody] = useState('');
  const [generationStarted, setGenerationStarted] = useState(false); 
  const [generationProgress, setGenerationProgress] = useState({ current: 0, total: 0 }); 
  const [isGenerating, setIsGenerating] = useState(false); 
  const [isRegenerating, setIsRegenerating] = useState(false);
  const abortRef = useRef(false); 

  useEffect(() => {
    window.api.getHalfAutoSend()
      .then((enabled) => {
        setHalfAutoEnabled(enabled);
      })
      .catch((err) => {
        console.error('Error fetching halfAutoEnabled state:', err);
        setHalfAutoEnabled(false); 
      });
  }, []);

  useEffect(() => {
    if (halfAutoEnabled === null) return; 

    if (halfAutoEnabled) {
      setLoading(true);

      Promise.all([
        window.api.getRepliedEmailIds().catch(err => {
          console.warn('Could not fetch replied email ids, proceeding without:', err);
          return [];
        }),
        window.api.readGeneratedReplies().catch(err => {
          console.warn('Could not read stored replies, proceeding with empty:', err);
          return {};
        }),
        window.api.getUnreadEmails()
      ])
      .then(([repliedIds, storedReplies, unreadData]) => {
        console.log('Unread emails fetched:', unreadData);
        console.log('Replied email ids:', repliedIds);
        console.log('Stored replies fetched:', storedReplies);

        const filteredEmails = Array.isArray(unreadData)
          ? unreadData.filter(e => !repliedIds.includes(e.id))
          : [];

        setRepliedEmailIds(Array.isArray(repliedIds) ? repliedIds : []);
        setEmails(filteredEmails);
        setGeneratedReplies(storedReplies || {});
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching unread emails or dependencies:', err);
        setLoading(false);
      });
    }
  }, [halfAutoEnabled]);

  const handleStartGeneration = async () => {
    if (isGenerating || emails.length === 0) return;
    
    setGenerationStarted(true);
    setIsGenerating(true);
    abortRef.current = false;

    const emailsToGenerate = emails.filter(email => !generatedReplies[email.id]);
    setGenerationProgress({ current: 0, total: emailsToGenerate.length });

    if (emailsToGenerate.length === 0) {
      setRepliesGenerated(true);
      setIsGenerating(false);
      showSnackbar && showSnackbar('Minden levél már elő van készítve!', 'info');
      return;
    }

    const updatedReplies = { ...generatedReplies };
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < emailsToGenerate.length; i++) {
      if (abortRef.current) {
        console.log('Generation aborted by user');
        break;
      }

      const email = emailsToGenerate[i];
      setGenerationProgress({ current: i + 1, total: emailsToGenerate.length });

      try {
        console.log(`Generating reply ${i + 1}/${emailsToGenerate.length} for email:`, { id: email.id, subject: email.subject });
        
        let fullEmail;
        try {
          fullEmail = await window.api.getEmailById(email.id);
          if (!fullEmail || !fullEmail.body) {
            console.warn('Full email missing body - using snippet as fallback for email id:', email.id);
            fullEmail = { ...email, body: email.snippet || '' };
          }
        } catch (fetchErr) {
          console.warn('Could not fetch full email, using list data:', fetchErr);
          fullEmail = { ...email, body: email.snippet || '' };
        }

        const reply = await Promise.race([
          window.api.generateReply(fullEmail),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Generation timeout')), 120000)) // 2 min timeout
        ]);

        if (!reply || !reply.body) {
          console.warn('Generated reply body is undefined, using fallback for email id:', email.id);
          updatedReplies[email.id] = {
            subject: `Re: ${email.subject || ''}`,
            body: fullEmail.body || email.snippet || ''
          };
        } else {
          updatedReplies[email.id] = {
            subject: reply.subject || `Re: ${email.subject || ''}`,
            body: reply.body
          };
        }

        successCount++;

        try {
          await window.api.saveGeneratedReplies(updatedReplies);
        } catch (saveErr) {
          console.warn('Could not save generated replies:', saveErr);
        }

        setGeneratedReplies({ ...updatedReplies });

      } catch (err) {
        console.error(`Error generating reply for email ${email.id}:`, err);
        errorCount++;
      }

      if (i < emailsToGenerate.length - 1 && !abortRef.current) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    setRepliesGenerated(true);
    setIsGenerating(false);
    
    if (errorCount > 0) {
      showSnackbar && showSnackbar(`Előkészítés kész: ${successCount} sikeres, ${errorCount} sikertelen`, 'warning');
    } else if (successCount > 0) {
      showSnackbar && showSnackbar(`${successCount} levél sikeresen előkészítve!`, 'success');
    }
  };

  const handleCancelGeneration = () => {
    abortRef.current = true;
    showSnackbar && showSnackbar('Előkészítés megszakítva', 'info');
  };

  const handleSendAllReplies = () => {
    setSending(true);
    const promises = emails.map(email => {
      const reply = generatedReplies[email.id];
      if (reply && reply.body) {
        console.log('Sending reply for email:', email.id);
        return window.api.sendReply({
          to: email.from,
          subject: reply.subject,
          body: reply.body,
          emailId: email.id
        });
      }
      return Promise.resolve();
    });

    Promise.all(promises)
      .then(() => {
        setSending(false);
        window.api.getRepliedEmailIds().then(ids => {
          setRepliedEmailIds(ids || []);
          setEmails(prev => prev.filter(e => !ids.includes(e.id)));
        showSnackbar && showSnackbar('Sikeresen elküldve', 'success');
        }).catch(()=>{});
      })
      .catch(err => {
        console.error('Error sending all replies:', err);
        setSending(false);
      });
  };

  const handleViewChange = (view) => {
    window.api.setView(view);
  };

  const handleOpenEmail = (email) => {
    setSelectedEmail(email);
    setLoadingFull(true);
    window.api.getEmailById(email.id)
      .then((data) => {
        const e = data || email;
        setFullEmail(e);
        const reply = generatedReplies[email.id] || {};
        setReplySubject(reply.subject || `Re: ${email.subject || ''}`);
        setReplyBody(reply.body || '');
        setLoadingFull(false);
      })
      .catch(err => {
        console.warn('Could not load full email, using list data:', err);
        setFullEmail(email);
        const reply = generatedReplies[email.id] || {};
        setReplySubject(reply.subject || `Re: ${email.subject || ''}`);
        setReplyBody(reply.body || '');
        setLoadingFull(false);
      });
  };

  const handleBackFromOpen = () => {
    setSelectedEmail(null);
    setFullEmail(null);
    setReplySubject('');
    setReplyBody('');
  };

  const handleSaveSelectedReply = () => {
    if (!selectedEmail) return;
    const id = selectedEmail.id;
    setSavingIds(prev => [...prev, id]);
    window.api.readGeneratedReplies().then(stored => {
      const merged = { ...(stored || {}), ...(generatedReplies || {}) };
      merged[id] = { subject: replySubject, body: replyBody };
      return window.api.saveGeneratedReplies(merged).then(() => {
        setGeneratedReplies(prev => ({ ...(prev || {}), [id]: { subject: replySubject, body: replyBody } }));
      });
    }).then(() => {
      setSavingIds(prev => prev.filter(x => x !== id));
    }).catch(err => {
      console.error('Error saving selected reply for', id, err);
      setSavingIds(prev => prev.filter(x => x !== id));
    });
  };

  const handleRegenerateReply = async () => {
    if (!selectedEmail || isRegenerating) return;
    const id = selectedEmail.id;
    setIsRegenerating(true);

    try {
      let emailData;
      try {
        emailData = await window.api.getEmailById(id);
        if (!emailData || !emailData.body) {
          emailData = { ...selectedEmail, body: selectedEmail.snippet || '' };
        }
      } catch (fetchErr) {
        console.warn('Could not fetch full email for regeneration:', fetchErr);
        emailData = { ...selectedEmail, body: selectedEmail.snippet || '' };
      }

      const reply = await Promise.race([
        window.api.generateReply(emailData),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Generation timeout')), 120000))
      ]);

      if (!reply || !reply.body) {
        console.warn('Regenerated reply body is undefined');
        setReplySubject(`Re: ${selectedEmail.subject || ''}`);
        setReplyBody(emailData.body || selectedEmail.snippet || '');
      } else {
        setReplySubject(reply.subject || `Re: ${selectedEmail.subject || ''}`);
        setReplyBody(reply.body);
      }

      // Save the regenerated reply
      const updatedReplies = { ...generatedReplies };
      updatedReplies[id] = {
        subject: reply?.subject || `Re: ${selectedEmail.subject || ''}`,
        body: reply?.body || emailData.body || ''
      };
      setGeneratedReplies(updatedReplies);

      try {
        await window.api.saveGeneratedReplies(updatedReplies);
      } catch (saveErr) {
        console.warn('Could not save regenerated reply:', saveErr);
      }

      showSnackbar && showSnackbar('Válasz újra generálva!', 'success');
    } catch (err) {
      console.error('Error regenerating reply:', err);
      showSnackbar && showSnackbar('Hiba az újragenerálás során!', 'error');
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleSendSelectedReply = () => {
    if (!selectedEmail) return;
    const id = selectedEmail.id;
    if (!replyBody) return;
    setSending(true);
    window.api.sendReply({
      to: selectedEmail.from,
      subject: replySubject,
      body: replyBody,
      emailId: id
    }).then(() => {
      setSending(false);
      window.api.getRepliedEmailIds().then(ids => {
        setRepliedEmailIds(ids || []);
        setEmails(prev => prev.filter(e => !ids.includes(e.id)));
        handleBackFromOpen();
        showSnackbar && showSnackbar('Sikeresen elküldve', 'success');
      }).catch(() => {
        handleBackFromOpen();
      });
    }).catch(err => {
      console.error('Error sending selected reply:', err);
      setSending(false);
    });
  };

  if (halfAutoEnabled === null) {
    return <CenteredLoading />;
  }

  if (!halfAutoEnabled) {
    return (
      <Paper sx={{ p: 4,
        maxHeight: '550px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column' }}>
        <Typography variant="h4" gutterBottom>
          Előkészített levelek    
        </Typography>
        <Typography variant="body1" sx={{ mt: 2 }}>
          Kapcsold be a "Félautomata válaszküldés" opciót a beállításokban az előkészített levelek megtekintéséhez.
          <IconButton onClick={() => handleViewChange('settings')} size="large" sx={{ ml: 1, color: 'primary.main' }}>
              <FaArrowCircleRight />
          </IconButton>
        </Typography>
      </Paper>
    );
  } else if (loading) {
    return <CenteredLoading helperText={"Levelek betöltése..."} />;
  } else if (emails.length === 0) {
    return (
      <Paper sx={{ p: 4,
        maxHeight: '900px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column' }}>
        <Typography variant="h4" gutterBottom>
          Előkészített levelek
        </Typography>
        <Typography variant="body1" sx={{ mt: 2 }}>
          Nincsenek előkészített levelek.
        </Typography>
        <Button
          variant="contained"
          color="primary"
          sx={{ mt: 2 }}
          onClick={handleSendAllReplies}
          disabled={true}
        >
          Összes válasz elküldése
        </Button>
      </Paper>
    );
  } else {
    const filteredEmails = emails.filter(email => {
      const q = search.toLowerCase();
      const matches = (
        (!q) ||
        (email.subject && email.subject.toLowerCase().includes(q)) ||
        (email.from && email.from.toLowerCase().includes(q)) ||
        (generatedReplies[email.id] && generatedReplies[email.id].body && generatedReplies[email.id].body.toLowerCase().includes(q)) ||
        (email.body && email.body.toLowerCase().includes(q)) ||
        (email.snippet && email.snippet.toLowerCase().includes(q))
      );
      return matches;
    });

    const anyPrepared = filteredEmails.some(e => generatedReplies[e.id] && generatedReplies[e.id].body);

    if (selectedEmail) {
      return (
        <Paper sx={{ 
          p: 4,
          maxHeight: '90vh',
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
            variant="h5" 
            gutterBottom
            sx={{
              fontWeight: 700,
              background: 'linear-gradient(135deg, currentColor 0%, rgba(168, 85, 247, 0.8) 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
            }}
          >
            Előkészített levél szerkesztése
          </Typography>
          {loadingFull || !fullEmail ? (
            <CenteredLoading size={48} text={'Betöltés...'} />
          ) : (
            <>
              <Box sx={{
                p: 2,
                borderRadius: 2,
                background: 'rgba(168, 85, 247, 0.05)',
                border: '1px solid rgba(168, 85, 247, 0.15)',
                mb: 2,
              }}>
                <Typography><strong>Válasz a következő címzettnek:</strong> {fullEmail.from}</Typography>
              </Box>
              <TextField
                label="Tárgy"
                variant="outlined"
                sx={{ mt: 2 }}
                value={replySubject}
                onChange={(e) => setReplySubject(e.target.value)}
              />
              <TextField
                label="Üzenet"
                variant="outlined"
                multiline
                rows={15}
                sx={{ mt: 2 }}
                value={replyBody}
                onChange={(e) => setReplyBody(e.target.value)}
              />
              <Box sx={{ mt: 4, display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
                <Button variant="outlined" onClick={handleBackFromOpen} disabled={isRegenerating}>Vissza</Button>
                <Button variant="contained" color="secondary" onClick={handleRegenerateReply} disabled={isRegenerating || sending}>{isRegenerating ? 'Generálás...' : 'Újra generálás'}</Button>
                <Button variant="contained" color="primary" onClick={handleSendSelectedReply} disabled={sending || isRegenerating}>Küldés</Button>
              </Box>
            </>
          )}
        </Paper>
      );
    }

    return (
      <Paper sx={{ 
        p: 4,
        maxHeight: '900px',
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
            background: 'linear-gradient(135deg, currentColor 0%, rgba(168, 85, 247, 0.8) 100%)',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
          }}
        >
          Előkészített levelek
        </Typography>

        {/* Progress bar during generation */}
        {isGenerating && (
          <Box sx={{ 
            mb: 3,
            p: 3,
            borderRadius: 2,
            background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.1) 0%, rgba(99, 102, 241, 0.05) 100%)',
            border: '1px solid rgba(168, 85, 247, 0.2)',
          }}>
            <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
              Előkészítés folyamatban: {generationProgress.current} / {generationProgress.total}
            </Typography>
            <LinearProgress 
              variant="determinate" 
              value={generationProgress.total > 0 ? (generationProgress.current / generationProgress.total) * 100 : 0}
              sx={{
                height: 8,
                borderRadius: 4,
                backgroundColor: 'rgba(168, 85, 247, 0.2)',
                '& .MuiLinearProgress-bar': {
                  borderRadius: 4,
                  background: 'linear-gradient(90deg, #a855f7, #6366f1)',
                },
              }}
            />
          </Box>
        )}

        {/* Generation button - shows when not all emails have replies */}
        {(() => {
          const emailsWithoutReply = filteredEmails.filter(e => !generatedReplies[e.id] || !generatedReplies[e.id].body);
          if (emailsWithoutReply.length > 0) {
            return (
              <Box sx={{ mb: 3, display: 'flex', gap: 2, alignItems: 'center' }}>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleStartGeneration}
                  disabled={isGenerating}
                  sx={{
                    background: 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)',
                    '&:hover': {
                      background: 'linear-gradient(135deg, #c084fc 0%, #a855f7 100%)',
                    },
                  }}
                >
                  {isGenerating ? 'Előkészítés folyamatban...' : `Levelek előkészítése (${emailsWithoutReply.length} db)`}
                </Button>
                {isGenerating && (
                  <Button
                    variant="outlined"
                    color="error"
                    onClick={handleCancelGeneration}
                  >
                    Megszakítás
                  </Button>
                )}
              </Box>
            );
          }
          return null;
        })()}

        <TextField
          label="Keresés az előkészített levelekben"
          variant="outlined"
          fullWidth
          sx={{ 
            mb: 3,
            '& .MuiOutlinedInput-root': {
              background: 'rgba(168, 85, 247, 0.05)',
              transition: 'all 0.2s ease',
              '&:hover': {
                background: 'rgba(168, 85, 247, 0.08)',
              },
            },
          }}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        <Box sx={{ mt: 2, overflowY: 'auto', flex: 1 }}>
          {filteredEmails.map((email, index) => (
            <Box
              key={email.id}
              sx={{ 
                mb: 2, 
                p: 3, 
                background: generatedReplies[email.id]?.body 
                  ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.08) 0%, rgba(168, 85, 247, 0.05) 100%)'
                  : 'linear-gradient(135deg, rgba(168, 85, 247, 0.05) 0%, rgba(99, 102, 241, 0.02) 100%)',
                border: generatedReplies[email.id]?.body 
                  ? '1px solid rgba(34, 197, 94, 0.2)'
                  : '1px solid rgba(168, 85, 247, 0.15)',
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
                  transform: 'translateX(6px)',
                  boxShadow: '0 4px 20px rgba(168, 85, 247, 0.2)',
                },
              }}
              onClick={() => handleOpenEmail(email)}
            >
              <Typography sx={{ fontWeight: 600, mb: 0.5 }}><strong>Feladó:</strong> {email.from}</Typography>
              <Typography sx={{ mb: 0.5 }}><strong>Tárgy:</strong> {email.subject}</Typography>
              <Typography sx={{ mt: 1, fontSize: '0.9rem', color: 'text.secondary' }}>{email.snippet || (email.body && (email.body.length > 200 ? `${email.body.slice(0, 200)}...` : email.body))}</Typography>

              {/* generated reply preview */}
              <Box sx={{ 
                mt: 2, 
                p: 2, 
                borderRadius: 2,
                background: generatedReplies[email.id]?.body ? 'rgba(34, 197, 94, 0.05)' : 'rgba(239, 68, 68, 0.05)',
                border: `1px solid ${generatedReplies[email.id]?.body ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)'}`,
              }}>
                <Typography sx={{ fontWeight: 500, fontSize: '0.85rem', color: generatedReplies[email.id]?.body ? 'success.main' : 'error.main' }}>
                  Válasz előnézet:
                </Typography>
                <Typography sx={{ whiteSpace: 'pre-wrap', mt: 1, fontSize: '0.9rem' }}>
                  {generatedReplies[email.id]?.body ? (generatedReplies[email.id].body.length > 100 ? `${generatedReplies[email.id].body.slice(0, 100)}...` : generatedReplies[email.id].body) : <em style={{ opacity: 0.7 }}>Nincs előkészített válasz</em>}
                </Typography>
              </Box>
            </Box>
          ))}
        </Box>
        <Button
          variant="contained"
          color="primary"
          sx={{ 
            mt: 3,
            py: 1.5,
            background: anyPrepared ? 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)' : undefined,
            '&:hover': anyPrepared ? {
              background: 'linear-gradient(135deg, #4ade80 0%, #22c55e 100%)',
            } : undefined,
          }}
          onClick={handleSendAllReplies}
          disabled={sending || !anyPrepared || isGenerating}
        >
          {sending ? 'Küldés folyamatban...' : 'Összes válasz elküldése'}
        </Button>
      </Paper>
    );
  }
};

export default GeneratedMailsView;