import React, { useState, useEffect } from 'react';
import { Box, Typography, Paper, Button, TextField, Tabs, Tab, Grid, Stack, CircularProgress } from '@mui/material';
import CenteredLoading from './CenteredLoading';

const PromptView = ({ showSnackbar }) => {
  const [greeting, setGreeting] = useState('');
  const [signature, setSignature] = useState('');
  const [signatureImage, setSignatureImage] = useState('');
  const [signatureText, setSignatureText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState(null);

  const [section, setSection] = useState('greeting');

  // Use full available width for section panels to maximize space
  const sectionWidth = '100%';

  // Shared styles for inner section Papers: fixed height and scroll when content overflows
  const sectionPaperSx = { 
    p: 4, 
    background: 'linear-gradient(145deg, rgba(99, 102, 241, 0.08) 0%, rgba(30, 30, 40, 0.95) 100%)',
    color: 'white', 
    borderRadius: 3, 
    boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
    border: '1px solid rgba(99, 102, 241, 0.15)',
    height: '470px', 
    overflowY: 'auto',
    animation: 'slideIn 0.3s ease forwards',
    '@keyframes slideIn': {
      from: { opacity: 0, transform: 'translateX(-10px)' },
      to: { opacity: 1, transform: 'translateX(0)' },
    },
  };

  // Preview URL for images (when selecting before upload)
  const [signaturePreviewUrl, setSignaturePreviewUrl] = useState(null);

  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingFileData, setPendingFileData] = useState(null);

  // Attachment state
  const [attachmentFile, setAttachmentFile] = useState(null);
  const [attachmentFileName, setAttachmentFileName] = useState('');
  const [attachmentFileSize, setAttachmentFileSize] = useState(0);
  const [attachmentUploading, setAttachmentUploading] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);
  // List attachments from backend
  const fetchAttachments = async () => {
    setAttachmentsLoading(true);
    try {
      const result = await window.api.listAttachments?.();
      if (Array.isArray(result)) {
        setAttachments(result);
      } else {
        setAttachments([]);
      }
    } catch (e) {
      setAttachments([]);
    }
    setAttachmentsLoading(false);
  };

  // Delete attachment handler
  const handleDeleteAttachment = async (name) => {
    try {
      const result = await window.api.deleteAttachment({ name });
      if (result.success) {
        showSnackbar('Csatolmány törölve!', 'success');
        fetchAttachments();
      } else {
        showSnackbar('Hiba a törléskor: ' + (result.error || ''), 'error');
      }
    } catch (e) {
      showSnackbar('Hiba a törléskor!', 'error');
    }
  };
  // Attachment file select handler
  const handleAttachmentSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) { // 25MB
      showSnackbar('A fájl mérete nem lehet nagyobb 25 MB-nál!', 'error');
      return;
    }
    setAttachmentFile(file);
    setAttachmentFileName(file.name);
    setAttachmentFileSize(file.size);
  };

  // Attachment upload handler
  const handleAttachmentUpload = async () => {
    if (!attachmentFile) return;
    setAttachmentUploading(true);
    try {
      // Read file as ArrayBuffer
      const reader = new FileReader();
      reader.onload = async (event) => {
        const arrayBuffer = event.target.result;
        // Call API to upload attachment
        try {
          const result = await window.api.uploadAttachment({
            name: attachmentFileName,
            size: attachmentFileSize,
            content: arrayBuffer
          });
          if (result.success !== false) {
            showSnackbar('Csatolmány sikeresen feltöltve!', 'success');
            setAttachmentFile(null);
            setAttachmentFileName('');
            setAttachmentFileSize(0);
            // Frissítjük a csatolmányok listáját
            fetchAttachments();
          } else {
            showSnackbar(`Hiba a csatolmány feltöltésekor: ${result.error}`, 'error');
          }
        } catch (err) {
          showSnackbar('Hiba a csatolmány feltöltésekor!', 'error');
        }
        setAttachmentUploading(false);
      };
      reader.readAsArrayBuffer(attachmentFile);
    } catch (err) {
      showSnackbar('Hiba a csatolmány feltöltésekor!', 'error');
      setAttachmentUploading(false);
    }
  };

  const handleImgSelect = async () => {
    try {
      const result = await window.api.showImageDialog();
      if (result.success) {
        setSelectedFileName(result.filePath);
        setPendingFileData(result.content);
        setShowConfirm(true);
      }
    } catch (error) {
      showSnackbar('Hiba történt a fájl kiválasztása során!', 'error');
      console.error('Fájl kiválasztási hiba:', error);
    }
  };

  const handleImgDelete = async () => {
    setLoading(true);
    try {
      const deleteResult = await window.api.deleteSignatureImage?.();
      if (deleteResult?.success !== false) {
        setSignatureImage('');
        setSignaturePreviewUrl(null);
        showSnackbar('Kép sikeresen törölve!', 'success');
      } else {
        showSnackbar(`Hiba történt a törlés során: ${deleteResult?.error}`, 'error');
      }
    } catch (error) {
      showSnackbar('Hiba történt a kép törlése során!', 'error');
      console.error('Kép törlési hiba:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    try {
      setLoading(true);
      const uploadResult = await window.api.uploadImageFile(pendingFileData);
      if (uploadResult.success !== false) {
        // After upload succeed, convert pendingFileData (ArrayBuffer or base64/data URL string)
        // into a stable data URL and store it in signatureImage so preview stays visible.
        try {
          let dataUrl = null;
          if (pendingFileData) {
            if (typeof pendingFileData === 'string') {
              if (pendingFileData.startsWith('data:')) {
                dataUrl = pendingFileData;
              } else {
                dataUrl = `data:image/png;base64,${pendingFileData}`;
              }
            } else if (pendingFileData instanceof ArrayBuffer || ArrayBuffer.isView(pendingFileData)) {
              // Convert ArrayBuffer/TypedArray to data URL
              const blob = new Blob([pendingFileData]);
              dataUrl = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.readAsDataURL(blob);
              });
            }
          }

          if (dataUrl) {
            setSignatureImage(dataUrl);
            setSignaturePreviewUrl(dataUrl);
          } else {
            // Fallback to known static path used by app
            setSignatureImage('src/images/signature.png');
          }

          // Buildelt módban próbáljuk a képet az exe mellé is másolni
          if (window.api.copyImageToExeRoot) {
            await window.api.copyImageToExeRoot();
          }

          showSnackbar('Fájl sikeresen feltöltve!', 'success');
          setSelectedFileName(null);
        } catch (convErr) {
          console.error('Preview conversion error:', convErr);
          showSnackbar('Fájl feltöltve, de előnézet konvertálása sikertelen.', 'warning');
        }
      } else {
        showSnackbar(`Hiba történt a feltöltés során: ${uploadResult.error}`, 'error');
      }
    } catch (error) {
      showSnackbar('Hiba történt a fájl feltöltése során!', 'error');
      console.error('Fájl feltöltési hiba:', error);
    } finally {
      setLoading(false);
      setShowConfirm(false);
      setPendingFileData(null);
    }
  };

  const handleCancel = () => {
    setShowConfirm(false);
    setSelectedFileName(null);
    setPendingFileData(null);
  };

  useEffect(() => {
    window.api.getPromptSettings?.().then((settings) => {
      setGreeting(settings?.greeting || '');
      setSignature(settings?.signature || '');
      setSignatureImage(settings?.signatureImage || '');
      setSignatureText(settings?.signatureText || '');
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });
    fetchAttachments();
  }, []);

  // Build preview URL when pendingFileData changes (supports ArrayBuffer, base64 string, or data URL)
  useEffect(() => {
    let url = null;
    if (!pendingFileData) {
      setSignaturePreviewUrl(null);
      return;
    }

    try {
      // If it's an ArrayBuffer (or typed array), create a blob URL
      if (pendingFileData instanceof ArrayBuffer || ArrayBuffer.isView(pendingFileData)) {
        const blob = new Blob([pendingFileData]);
        url = URL.createObjectURL(blob);
      } else if (typeof pendingFileData === 'string') {
        // If string starts with data: it's already a data URL
        if (pendingFileData.startsWith('data:')) {
          url = pendingFileData;
        } else {
          // Assume base64 image data (png) and build a data URL
          url = `data:image/png;base64,${pendingFileData}`;
        }
      }
    } catch (err) {
      console.error('Error creating preview URL for image:', err);
      url = null;
    }

    setSignaturePreviewUrl(url);

    return () => {
      if (url && url.startsWith('blob:')) {
        try { URL.revokeObjectURL(url); } catch (e) { }
      }
    };
  }, [pendingFileData]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await window.api.savePromptSettings?.({ greeting, signature, signatureText, signatureImage });
      showSnackbar('Sikeresen mentve!', 'success');
    } catch (e) {
      showSnackbar('Hiba mentéskor!', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <CenteredLoading />;

  return (
    <Paper sx={{ 
      p: 4, 
      maxHeight: '85vh', 
      height: '85vh', 
      overflowY: 'auto',
      background: 'linear-gradient(135deg, rgba(30, 30, 40, 0.95) 0%, rgba(20, 20, 30, 0.98) 100%)',
      borderRadius: 3,
      animation: 'fadeIn 0.4s ease forwards',
      '@keyframes fadeIn': {
        from: { opacity: 0, transform: 'translateY(8px)' },
        to: { opacity: 1, transform: 'translateY(0)' },
      },
    }}>
      <Tabs 
        value={section} 
        onChange={(e, val) => setSection(val)} 
        variant="standard" 
        centered 
        sx={{ 
          mb: 3,
          '& .MuiTabs-indicator': {
            height: 3,
            borderRadius: 2,
            background: 'linear-gradient(90deg, #6366f1, #a855f7)',
          },
          '& .MuiTab-root': {
            fontWeight: 600,
            textTransform: 'none',
            fontSize: '0.95rem',
            transition: 'all 0.2s ease',
            '&.Mui-selected': {
              color: '#a855f7',
            },
            '&:hover': {
              color: '#6366f1',
              transform: 'translateY(-1px)',
            },
          },
        }}
      >
        <Tab label="Megszólítás szövege" value="greeting" />
        <Tab label="Üdvözlés szövege" value="signature" />
        <Tab label="Aláírás" value="signatureText" />
        <Tab label="Signo" value="signo" />
        <Tab label="Csatolmány" value="attachment" />
      </Tabs>

      <Box sx={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
        <Box sx={{ width: sectionWidth, maxWidth: 1200 }}>
          {section === 'greeting' && (
            <Paper
              variant="outlined"
              sx={sectionPaperSx}
            >
              <Typography
                variant="h6"
                align="center"
                gutterBottom
                sx={{ 
                  color: 'white', 
                  fontSize: { xs: '1.25rem', sm: '1.45rem', md: '1.56rem' },
                  fontWeight: 700,
                  background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                Megszólítás
              </Typography>
              <TextField
                label="Ide írhatja, milyen megszólítás szerepeljen a levélben"
                variant="outlined"
                fullWidth
                multiline
                rows={8}
                sx={{ 
                  mt: 2, 
                  '& .MuiInputBase-input': { fontSize: '1.25rem' }, 
                  '& .MuiInputLabel-root': { fontSize: '1.13rem' },
                  '& .MuiOutlinedInput-root': {
                    background: 'rgba(0, 0, 0, 0.2)',
                    borderRadius: 2,
                  },
                }}
                value={greeting}
                onChange={e => setGreeting(e.target.value)}
                disabled={loading}
                InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.85)' } }}
                inputProps={{ style: { color: 'white' } }}
              />
            </Paper>
          )}

          {section === 'signature' && (
            <Paper variant="outlined" sx={sectionPaperSx}>
              <Typography 
                variant="h6" 
                align="center" 
                gutterBottom 
                sx={{ 
                  color: 'white', 
                  fontSize: { xs: '1.25rem', sm: '1.45rem', md: '1.56rem' },
                  fontWeight: 700,
                  background: 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                Üdvözlés
              </Typography>
              <TextField
                label="Ide írhatja, milyen üdvözlés szerepeljen a levélben"
                variant="outlined"
                fullWidth
                multiline
                rows={8}
                sx={{ 
                  mt: 2, 
                  '& .MuiInputBase-input': { fontSize: '1.25rem' },
                  '& .MuiOutlinedInput-root': {
                    background: 'rgba(0, 0, 0, 0.2)',
                    borderRadius: 2,
                  },
                }}
                value={signature}
                onChange={e => setSignature(e.target.value)}
                disabled={loading}
                InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.85)' } }}
                inputProps={{ style: { color: 'white' } }}
              />
            </Paper>
          )}

          {section === 'signatureText' && (
            <Paper variant="outlined" sx={sectionPaperSx}>
              <Typography 
                variant="h6" 
                align="center" 
                gutterBottom 
                sx={{ 
                  color: 'white', 
                  fontSize: { xs: '1.25rem', sm: '1.45rem', md: '1.56rem' },
                  fontWeight: 700,
                  background: 'linear-gradient(135deg, #22c55e 0%, #10b981 100%)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                Aláírás
              </Typography>
              <TextField
                label="Itt szerkesztheti a levél aláírását"
                variant="outlined"
                fullWidth
                multiline
                rows={8}
                sx={{ 
                  mt: 2, 
                  '& .MuiInputBase-input': { fontSize: '1.25rem' },
                  '& .MuiOutlinedInput-root': {
                    background: 'rgba(0, 0, 0, 0.2)',
                    borderRadius: 2,
                  },
                }}
                value={signatureText}
                onChange={e => setSignatureText(e.target.value)}
                disabled={loading}
                InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.85)' } }}
                inputProps={{ style: { color: 'white' } }}
              />
            </Paper>
          )}

          {section === 'signo' && (
            <Paper variant="outlined" sx={sectionPaperSx}>
              <Typography 
                variant="h6" 
                align="center" 
                gutterBottom 
                sx={{ 
                  color: 'white', 
                  fontSize: { xs: '1.25rem', sm: '1.45rem', md: '1.56rem' },
                  fontWeight: 700,
                  background: 'linear-gradient(135deg, #f59e0b 0%, #ec4899 100%)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                Signo
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3, mt: 2, alignItems: 'center', justifyContent: 'center' }}>
                {/* Left column: controls */}
                <Stack spacing={1.5} sx={{ width: '100%', maxWidth: 400 }}>
                  <Button
                    variant="contained"
                    onClick={handleImgSelect}
                    disabled={loading}
                    size="medium"
                    sx={{ 
                      width: '100%', 
                      py: 1, 
                      fontSize: '0.95rem', 
                      background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                      color: '#fff',
                      fontWeight: 600,
                      borderRadius: 2,
                      boxShadow: '0 4px 15px rgba(99, 102, 241, 0.3)',
                      transition: 'all 0.2s ease',
                      '&:hover': { 
                        background: 'linear-gradient(135deg, #818cf8 0%, #c084fc 100%)',
                        transform: 'translateY(-2px)',
                        boxShadow: '0 6px 20px rgba(99, 102, 241, 0.4)',
                      },
                    }}
                  >
                    {loading ? <CircularProgress size={18} /> : 'Kép fájl kiválasztása'}
                  </Button>

                  <Button
                    variant="contained"
                    onClick={handleImgDelete}
                    disabled={loading}
                    size="medium"
                    sx={{ 
                      width: '100%', 
                      py: 1, 
                      fontSize: '0.95rem', 
                      background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                      color: '#fff',
                      fontWeight: 600,
                      borderRadius: 2,
                      boxShadow: '0 4px 15px rgba(239, 68, 68, 0.3)',
                      transition: 'all 0.2s ease',
                      '&:hover': { 
                        background: 'linear-gradient(135deg, #f87171 0%, #ef4444 100%)',
                        transform: 'translateY(-2px)',
                        boxShadow: '0 6px 20px rgba(239, 68, 68, 0.4)',
                      },
                    }}
                  >
                    {loading ? <CircularProgress size={18} /> : 'Kép törlése'}
                  </Button>

                  {selectedFileName && (
                    <Typography sx={{ mt: 0.5, color: 'white', fontSize: { xs: '0.9rem', sm: '0.95rem' }, wordBreak: 'break-all', textAlign: 'center' }}>
                      Kiválasztott fájl: <strong>{selectedFileName}</strong>
                    </Typography>
                  )}

                  {showConfirm && (
                    <Paper sx={{ 
                      p: 2, 
                      background: 'rgba(30, 30, 40, 0.9)',
                      border: '1px solid rgba(168, 85, 247, 0.3)',
                      borderRadius: 2,
                    }}>
                      <Typography sx={{ mb: 1.5, fontSize: '0.95rem', textAlign: 'center' }}>
                        Figyelem! A feltöltés felülírja a meglévő signot. Biztosan szeretnéd folytatni?
                      </Typography>
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ justifyContent: 'center' }}>
                        <Button
                          variant="contained"
                          onClick={handleConfirm}
                          disabled={loading}
                          size="medium"
                          sx={{ 
                            background: 'linear-gradient(135deg, #22c55e 0%, #10b981 100%)',
                            color: '#fff',
                            fontWeight: 600,
                            fontSize: '0.95rem',
                            '&:hover': { 
                              background: 'linear-gradient(135deg, #4ade80 0%, #34d399 100%)',
                            },
                          }}
                        >
                          Feltöltés és felülírás
                        </Button>
                        <Button
                          variant="outlined"
                          onClick={handleCancel}
                          disabled={loading}
                          size="medium"
                          sx={{ 
                            color: 'white', 
                            borderColor: 'rgba(255,255,255,0.3)', 
                            fontSize: '0.95rem',
                            '&:hover': {
                              borderColor: 'rgba(255,255,255,0.5)',
                              background: 'rgba(255,255,255,0.05)',
                            },
                          }}
                        >
                          Mégsem
                        </Button>
                      </Stack>
                    </Paper>
                  )}
                </Stack>

                {/* Right column: preview */}
                <Box sx={{ 
                  width: 280, 
                  height: 280, 
                  flexShrink: 0, 
                  background: 'rgba(0, 0, 0, 0.3)',
                  borderRadius: 3, 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  overflow: 'hidden', 
                  border: '2px dashed rgba(168, 85, 247, 0.3)', 
                  boxShadow: 'inset 0 0 40px rgba(0,0,0,0.6)',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    borderColor: 'rgba(168, 85, 247, 0.5)',
                  },
                }}>
                  {signaturePreviewUrl || signatureImage ? (
                    <img
                      src={signaturePreviewUrl || signatureImage}
                      alt="Preview"
                      style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
                    />
                  ) : (
                    <Typography sx={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.95rem', textAlign: 'center', p: 2 }}>Nincs kép kiválasztva</Typography>
                  )}
                </Box>
              </Box>
            </Paper>
          )}

          {section === 'attachment' && (
            <Paper variant="outlined" sx={sectionPaperSx}>
              <Typography 
                variant="h6" 
                align="center" 
                gutterBottom 
                sx={{ 
                  color: 'white', 
                  fontSize: { xs: '1.25rem', sm: '1.45rem', md: '1.56rem' },
                  fontWeight: 700,
                  background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                Csatolmány
              </Typography>
              <Box sx={{ mt: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2, alignItems: 'center', justifyContent: 'center' }}>
                  <input
                    type="file"
                    id="attachment-input"
                    style={{ display: 'none' }}
                    onChange={handleAttachmentSelect}
                    disabled={attachmentUploading || loading}
                  />
                  <label htmlFor="attachment-input">
                    <Button 
                      variant="contained" 
                      component="span" 
                      disabled={attachmentUploading || loading}
                      sx={{
                        background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                        color: '#fff',
                        fontWeight: 600,
                        borderRadius: 2,
                        boxShadow: '0 4px 15px rgba(99, 102, 241, 0.3)',
                        transition: 'all 0.2s ease',
                        '&:hover': { 
                          background: 'linear-gradient(135deg, #818cf8 0%, #c084fc 100%)',
                          transform: 'translateY(-2px)',
                        },
                      }}
                    >
                      Fájl kiválasztása
                    </Button>
                  </label>
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={handleAttachmentUpload}
                    disabled={!attachmentFile || attachmentUploading || loading}
                    sx={{
                      background: 'linear-gradient(135deg, #22c55e 0%, #10b981 100%)',
                      color: '#fff',
                      fontWeight: 600,
                      borderRadius: 2,
                      boxShadow: '0 4px 15px rgba(34, 197, 94, 0.3)',
                      transition: 'all 0.2s ease',
                      '&:hover': { 
                        background: 'linear-gradient(135deg, #4ade80 0%, #34d399 100%)',
                        transform: 'translateY(-2px)',
                      },
                    }}
                  >
                    {attachmentUploading ? <CircularProgress size={24} /> : 'Feltöltés'}
                  </Button>
                </Box>
                {attachmentFileName && (
                  <Typography sx={{ color: 'white', fontSize: { xs: '0.95rem', sm: '1rem' }, textAlign: 'center' }}>
                    Kiválasztott fájl: {attachmentFileName} ({(attachmentFileSize / (1024 * 1024)).toFixed(2)} MB)
                  </Typography>
                )}
              </Box>

              <Box sx={{ mt: 4 }}>
                <Typography variant="subtitle1" sx={{ mb: 2, textAlign: 'center', fontWeight: 600 }}>Feltöltött csatolmányok:</Typography>
                {attachmentsLoading ? (
                  <CenteredLoading size={28} text={'Betöltés...'} />
                ) : attachments.length === 0 ? (
                  <Typography sx={{ textAlign: 'center', color: 'rgba(255,255,255,0.6)' }}>Nincs csatolmány feltöltve.</Typography>
                ) : (
                  <Box sx={{ maxWidth: 500, mx: 'auto' }}>
                    {attachments.map((file, index) => (
                      <Box 
                        key={file} 
                        sx={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          mb: 1, 
                          p: 1.5, 
                          background: 'rgba(6, 182, 212, 0.08)',
                          border: '1px solid rgba(6, 182, 212, 0.15)',
                          borderRadius: 2,
                          animation: `fadeIn 0.3s ease forwards ${index * 0.1}s`,
                          opacity: 0,
                          transition: 'all 0.2s ease',
                          '@keyframes fadeIn': {
                            to: { opacity: 1 },
                          },
                          '&:hover': {
                            background: 'rgba(6, 182, 212, 0.12)',
                            transform: 'translateX(4px)',
                          },
                        }}
                      >
                        <Typography sx={{ flex: 1, wordBreak: 'break-all' }}>{file}</Typography>
                        <Button
                          variant="outlined"
                          color="error"
                          size="small"
                          onClick={() => handleDeleteAttachment(file)}
                          sx={{ 
                            ml: 2, 
                            flexShrink: 0,
                            borderColor: 'rgba(239, 68, 68, 0.5)',
                            '&:hover': {
                              background: 'rgba(239, 68, 68, 0.15)',
                              borderColor: '#ef4444',
                            },
                          }}
                        >
                          Törlés
                        </Button>
                      </Box>
                    ))}
                  </Box>
                )}
              </Box>
            </Paper>
          )}

          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
            <Button 
              variant="contained" 
              color="primary" 
              onClick={handleSave} 
              disabled={saving || loading}
              sx={{
                background: 'linear-gradient(135deg, #22c55e 0%, #10b981 100%)',
                color: '#fff',
                fontWeight: 600,
                borderRadius: 2,
                px: 5,
                py: 1.2,
                boxShadow: '0 4px 15px rgba(34, 197, 94, 0.3)',
                transition: 'all 0.2s ease',
                '&:hover': { 
                  background: 'linear-gradient(135deg, #4ade80 0%, #34d399 100%)',
                  transform: 'translateY(-2px)',
                  boxShadow: '0 6px 20px rgba(34, 197, 94, 0.4)',
                },
              }}
            >
              {saving ? 'Mentés...' : 'Mentés'}
            </Button>
          </Box>
        </Box>
      </Box>
    </Paper>
  );
};

export default PromptView;