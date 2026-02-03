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
        <Paper sx={{ p: 4,
          maxHeight: '90vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column' }}>
          <Typography variant="h5" gutterBottom>Előkészített levél szerkesztése</Typography>
          {loadingFull || !fullEmail ? (
            <CenteredLoading size={48} text={'Betöltés...'} />
          ) : (
            <>
              <Typography><strong>Válasz a következő címzettnek:</strong> {fullEmail.from}</Typography>
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
                <Button variant="text" onClick={handleBackFromOpen} disabled={isRegenerating}>Vissza</Button>
                <Button variant="contained" color="primary" onClick={handleRegenerateReply} disabled={isRegenerating || sending}>{isRegenerating ? 'Generálás...' : 'Újra generálás'}</Button>
                <Button variant="contained" color="primary" onClick={handleSendSelectedReply} disabled={sending || isRegenerating}>Küldés</Button>
              </Box>
            </>
          )}
        </Paper>
      );
    }

    return (
      <Paper sx={{ p: 4,
        maxHeight: '900px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column' }}>
        <Typography variant="h4" gutterBottom>
          Előkészített levelek
        </Typography>

        {/* Progress bar during generation */}
        {isGenerating && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" sx={{ mb: 1 }}>
              Előkészítés folyamatban: {generationProgress.current} / {generationProgress.total}
            </Typography>
            <LinearProgress 
              variant="determinate" 
              value={generationProgress.total > 0 ? (generationProgress.current / generationProgress.total) * 100 : 0} 
            />
          </Box>
        )}

        {/* Generation button - shows when not all emails have replies */}
        {(() => {
          const emailsWithoutReply = filteredEmails.filter(e => !generatedReplies[e.id] || !generatedReplies[e.id].body);
          if (emailsWithoutReply.length > 0) {
            return (
              <Box sx={{ mb: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleStartGeneration}
                  disabled={isGenerating}
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
          sx={{ mb: 2 }}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        <Box sx={{ mt: 2, overflowY: 'auto', flex: 1 }}>
          {filteredEmails.map(email => (
            <Box
              key={email.id}
              sx={{ mb: 2, p: 2, border: '1px solid #333', borderRadius: 2, cursor: 'pointer' }}
              onClick={() => handleOpenEmail(email)}
            >
              <Typography><strong>Feladó:</strong> {email.from}</Typography>
              <Typography><strong>Tárgy:</strong> {email.subject}</Typography>
              <Typography sx={{ mt: 1 }}><strong>Üzenet</strong> {email.snippet || (email.body && (email.body.length > 200 ? `${email.body.slice(0, 200)}...` : email.body))}</Typography>

              {/* generated reply preview */}
              <Box sx={{ mt: 1, borderRadius: 1 }}>
                <Typography ><strong>Válasz előnézet:</strong></Typography>
                <Typography sx={{ whiteSpace: 'pre-wrap', mt: 1 }}>
                  {generatedReplies[email.id]?.body ? (generatedReplies[email.id].body.length > 100 ? `${generatedReplies[email.id].body.slice(0, 100)}...` : generatedReplies[email.id].body) : <em>Nincs előkészített válasz</em>}
                </Typography>
              </Box>
            </Box>
          ))}
        </Box>
        <Button
          variant="contained"
          color="primary"
          sx={{ mt: 2 }}
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