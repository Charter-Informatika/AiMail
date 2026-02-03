import React, { useState, useEffect } from 'react';
import { Box, Typography, Paper, CircularProgress, Button, TextField, IconButton, List, ListItem, ListItemText, Tabs, Tab } from '@mui/material';
import SheetEditorView from './SheetEditorView';
import { MdDelete } from 'react-icons/md';

const ImportFileView = ({ showSnackbar }) => {
  const [selectedFileName, setSelectedFileName] = useState(null);
  const [uploadedFilePath, setUploadedFilePath] = useState(null);
  const [uploadedFileName, setUploadedFileName] = useState(null);
  const [originalUploadedFileName, setOriginalUploadedFileName] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingFileData, setPendingFileData] = useState(null);
  const [webUrls, setWebUrls] = useState([]);
  const [newWebUrl, setNewWebUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [urlError, setUrlError] = useState('');
  const [section, setSection] = useState('websites');
  const [importProgress, setImportProgress] = useState([]);

  // Excel status
  const [excelExists, setExcelExists] = useState(false);

  // helper: save previous filename before replacing
  const replaceUploadedFileName = (newName) => {
    console.log('[ImportFileView] replaceUploadedFileName called', { newName, uploadedFileName });
    try {
      const prev = uploadedFileName || window.localStorage.getItem('uploadedFileName');
      if (prev && prev !== newName) {
        window.localStorage.setItem('previousUploadedFileName', prev);
      }
    } catch (e) {
      console.error('localStorage error saving previousUploadedFileName', e);
    }
    setUploadedFileName(newName);
  };

  const handleFileSelect = async () => {
    try {
      const result = await window.api.showFileDialog();
      console.log('[ImportFileView] showFileDialog result', result);
      if (result.success) {
        setSelectedFileName(result.filePath);
        setPendingFileData(result.content);
        setShowConfirm(true);
        try {
          const originalName = result.filePath ? result.filePath.split(/[/\\\\]/).pop() : null;
          console.log('[ImportFileView] extracted originalName from selection', { originalName });
          if (originalName) {
            setOriginalUploadedFileName(originalName);
            // show the selected original name immediately in the UI while preserving the previous stored name
            try {
              replaceUploadedFileName(originalName);
            } catch (e) {
              console.error('Error setting displayed uploadedFileName on select', e);
            }
          }
        } catch (e) {
          console.error('Error extracting original filename on select', e);
        }
      }
    } catch (error) {
      showSnackbar('Hiba történt a fájl kiválasztása során!', 'error');
      console.error('Fájl kiválasztási hiba:', error);
    }
  };

  const handleConfirm = async () => {
    try {
      setLoading(true);
      const uploadResult = await window.api.uploadExcelFile({ content: pendingFileData, originalPath: selectedFileName });
      console.log('[ImportFileView] uploadResult', uploadResult);
      if (uploadResult.success) {
        showSnackbar('Fájl sikeresen feltöltve!', 'success');
        // if main returned the filename, use it; otherwise fall back to parsing
        if (uploadResult.filename) {
          console.log('[ImportFileView] backend returned filename', uploadResult.filename);
          replaceUploadedFileName(uploadResult.filename);
        } else {
          try {
            const originalName = selectedFileName ? selectedFileName.split(/[/\\\\]/).pop() : null;
            console.log('[ImportFileView] fallback originalName on confirm', { originalName });
            if (originalName) replaceUploadedFileName(originalName);
          } catch (e) {
            console.error('Error extracting original filename', e);
          }
        }
        setSelectedFileName(null);
        // refresh excel status and path using returned path if present
        setExcelExists(true);
        if (uploadResult.path) {
          console.log('[ImportFileView] uploadResult.path', uploadResult.path);
          setUploadedFilePath(uploadResult.path);
          // If backend didn't return a filename, derive it from the returned path
          if (!uploadResult.filename) {
            try {
              const nameFromPath = uploadResult.path?.split(/[/\\\\]/).pop();
              if (nameFromPath) replaceUploadedFileName(nameFromPath);
            } catch (e) {
              console.error('Error extracting filename from uploadResult.path', e);
            }
          }
        } else {
          try {
            const path = await window.api.getExcelPath?.();
            setUploadedFilePath(path);
            // also set a readable filename for display
            try {
              const nameFromPath = path ? path.split(/[/\\\\]/).pop() : null;
              if (nameFromPath) replaceUploadedFileName(nameFromPath);
            } catch (e) {
              console.error('Error extracting filename from excel path', e);
            }
          } catch (e) {
            console.error('Unable to get excel path after upload', e);
          }
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
    setLoading(true);
    window.api.getWebSettings?.().then((settings) => {
      setWebUrls(settings?.webUrls || []);
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });

    // check if an excel file already exists
    window.api.getExcelStatus?.().then(async (exists) => {
      setExcelExists(!!exists);
      if (exists) {
        try {
          const path = await window.api.getExcelPath?.();
          setUploadedFilePath(path);
          // derive a readable filename from the path so the UI can display it
            try {
              const nameFromPath = path ? path.split(/[/\\\\]/).pop() : null;
              if (nameFromPath) replaceUploadedFileName(nameFromPath);
            } catch (e) {
              console.error('Error extracting filename from excel path', e);
            }
        } catch (e) {
          console.error('Error fetching excel path', e);
        }
      }
    }).catch(() => {});
  }, []);

  // Listen to import progress events from main process
  useEffect(() => {
    const handler = (data) => {
      setImportProgress((prev) => [...prev, data]);
    };
    try {
      window.api.receive('import-progress', handler);
    } catch (e) {
      console.error('Failed to attach import-progress listener', e);
    }
    return () => {
      try {
        window.api.remove('import-progress', handler);
      } catch (e) {
        // ignore
      }
    };
  }, []);

  // load saved displayed filename from localStorage on mount (so it survives view reloads)
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('uploadedFileName');
      if (saved) setUploadedFileName(saved);
      const savedOriginal = window.localStorage.getItem('originalUploadedFileName') || window.localStorage.getItem('previousUploadedFileName');
      if (savedOriginal) setOriginalUploadedFileName(savedOriginal);
    } catch (e) {
      // ignore localStorage failures
    }
  }, []);

  // persist uploadedFileName to localStorage so it remains visible across reloads
  useEffect(() => {
    try {
      if (uploadedFileName) {
        window.localStorage.setItem('uploadedFileName', uploadedFileName);
      } else {
        window.localStorage.removeItem('uploadedFileName');
      }
    } catch (e) {
      console.error('localStorage error saving uploadedFileName', e);
    }
  }, [uploadedFileName]);

  // persist original filename so we can show the user's original name even if backend renames the file
  useEffect(() => {
    try {
      if (originalUploadedFileName) {
        window.localStorage.setItem('originalUploadedFileName', originalUploadedFileName);
      } else {
        window.localStorage.removeItem('originalUploadedFileName');
      }
    } catch (e) {
      console.error('localStorage error saving originalUploadedFileName', e);
    }
  }, [originalUploadedFileName]);

  const handleAddUrl = () => {
    const trimmed = newWebUrl.trim();
    // limit: only 1 URL allowed
    if (!trimmed) return;
    if (webUrls.includes(trimmed)) return;
    if (webUrls.length >= 1) {
      showSnackbar?.('Csak egy weboldal adható meg (max 1). Töröld a meglévőt először.', 'error');
      return;
    }
    setWebUrls([...webUrls, trimmed]);
    setNewWebUrl('');
  };

  const handleDeleteUrl = (url) => {
    setWebUrls(webUrls.filter((item) => item !== url));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await window.api.saveWebSettings?.({ webUrls });
      showSnackbar('Sikeresen mentve!', 'success');
    } catch (e) {
      showSnackbar('Hiba mentéskor!', 'error');
    } finally {
      setSaving(false);
    }
  };

  const validateUrl = (url) => {
    const urlPattern = new RegExp(
      '^(https?:\\/\\/)?' + // protocol
      '((([a-zA-Z\\d]([a-zA-Z\\d-]*[a-zA-Z\\d])*)\\.)+[a-zA-Z]{2,}|' + // domain name
      '((\\d{1,3}\\.){3}\\d{1,3}))' + // OR ip (v4) address
      '(\\:\\d+)?(\\/[-a-zA-Z\\d%_.~+()]*)*' + // port and path
      '(\\?[;&a-zA-Z\\d%_.~+=-]*)?' + // query string
      '(\\#[-a-zA-Z\\d_]*)?$',
      'i' // fragment locator
    );
    return !!urlPattern.test(url);
  };

  const handleUrlChange = (e) => {
    const value = e.target.value;
    setNewWebUrl(value);
    if (value && !validateUrl(value)) {
      setUrlError('Érvénytelen URL formátum!');
    } else {
      setUrlError('');
    }
  };


  // open the dedicated sheet editor view
  const openSheetEditor = () => {
    // open the sheet editor inline under the same tab UI instead of switching the whole app view
    setSection('editor');
  };

  // when the user navigates to the editor tab, automatically open the sheet editor if an excel exists
  useEffect(() => {
    if (section === 'editor') {
      if (excelExists) {
        try {
          // editor is embedded in this component now; no app-level view switch required
        } catch (e) {
          console.error('Failed to open sheet editor on tab change', e);
        }
      }
    }
  }, [section, excelExists]);

  return (
    <Paper sx={{ 
      p: 4, 
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
        <Tab label="Weboldalak" value="websites" />
        <Tab label="Adatbázis feltöltés" value="excel" />
        <Tab label="Adatbázis szerkesztés" value="editor" />
        <Tab label="Mappa feltöltés" value="file_import" />
      </Tabs>

      <Box>
        {section === 'websites' && (
          <Paper variant="outlined" sx={{ 
            p: 4, 
            background: 'linear-gradient(145deg, rgba(99, 102, 241, 0.08) 0%, rgba(30, 30, 40, 0.95) 100%)',
            color: 'white', 
            borderRadius: 3, 
            boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
            border: '1px solid rgba(99, 102, 241, 0.2)',
            animation: 'slideIn 0.3s ease forwards',
            '@keyframes slideIn': {
              from: { opacity: 0, transform: 'translateX(-10px)' },
              to: { opacity: 1, transform: 'translateX(0)' },
            },
          }}>
            <Typography 
              variant="h5" 
              gutterBottom 
              sx={{ 
                color: 'white', 
                textAlign: 'center',
                fontWeight: 700,
                background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Weboldalak megadása
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.75)', textAlign: 'center', maxWidth: 700, mx: 'auto', mb: 1 }}>
              Itt megadhatod a vállalkozásod, céged weboldalait, hogy az AI megértse mivel foglalkozik a céged, ezzel segítve a pontosabb válaszadást.
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.75)', textAlign: 'center', maxWidth: 700, mx: 'auto' }}>
              Az AI nem tudja feldolgozni a weboldalon lévő képeket, videókat, a további információkat az "Adatbázis szerkesztése" menüpont alatt tudod megadni.
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, mt: 2 }}>
              <TextField
                label="Új weboldal URL"
                fullWidth
                value={newWebUrl}
                onChange={handleUrlChange}
                error={!!urlError}
                helperText={urlError}
                sx={{ maxWidth: 640 }}
                InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.85)' } }}
                inputProps={{ style: { color: 'white' } }}
              />
              <Button 
                variant="contained" 
                onClick={handleAddUrl} 
                disabled={!newWebUrl.trim() || !!urlError || webUrls.length >= 1} 
                sx={{ 
                  mt: 1, 
                  background: 'linear-gradient(135deg, #ffd400 0%, #f59e0b 100%)',
                  color: '#000', 
                  fontWeight: 600,
                  borderRadius: 2,
                  boxShadow: '0 4px 15px rgba(255, 212, 0, 0.3)',
                  transition: 'all 0.2s ease',
                  '&:hover': { 
                    background: 'linear-gradient(135deg, #ffdb4d 0%, #fbbf24 100%)',
                    transform: 'translateY(-2px)',
                    boxShadow: '0 6px 20px rgba(255, 212, 0, 0.4)',
                  },
                  '&:disabled': {
                    background: 'rgba(255, 212, 0, 0.3)',
                  },
                  width: 180 
                }}
              >
                Hozzáadás
              </Button>
              <Typography sx={{ mt: 1, color: 'rgba(255,255,255,0.65)', fontWeight: 500 }}>Weboldalak: {webUrls.length} / 1</Typography>
            </Box>

            <List sx={{ mt: 3, maxHeight: 140, overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              {webUrls.map((url, index) => (
                <ListItem 
                  key={index} 
                  sx={{ 
                    width: '100%', 
                    maxWidth: 640, 
                    bgcolor: 'rgba(99, 102, 241, 0.08)', 
                    borderRadius: 2, 
                    mb: 1,
                    border: '1px solid rgba(99, 102, 241, 0.15)',
                    transition: 'all 0.2s ease',
                    animation: `fadeIn 0.3s ease forwards ${index * 0.1}s`,
                    opacity: 0,
                    '&:hover': {
                      bgcolor: 'rgba(99, 102, 241, 0.12)',
                      transform: 'translateX(4px)',
                    },
                  }} 
                  secondaryAction={
                    <IconButton 
                      edge="end" 
                      aria-label="delete" 
                      onClick={() => handleDeleteUrl(url)} 
                      sx={{ 
                        color: 'rgba(255, 255, 255, 0.7)',
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          color: '#ef4444',
                          background: 'rgba(239, 68, 68, 0.15)',
                        },
                      }}
                    >
                    <MdDelete />
                  </IconButton>
                }>
                  <ListItemText primary={url} primaryTypographyProps={{ sx: { color: 'white', wordBreak: 'break-all' } }} />
                </ListItem>
              ))}
            </List>

            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
              <Button 
                variant="contained" 
                onClick={handleSave} 
                disabled={saving || loading} 
                sx={{ 
                  mt: 1, 
                  background: 'linear-gradient(135deg, #22c55e 0%, #10b981 100%)',
                  color: '#fff', 
                  fontWeight: 600,
                  borderRadius: 2,
                  px: 4,
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
          </Paper>
        )}

        {section === 'excel' && (
          <Paper variant="outlined" sx={{ 
            p: 4, 
            mt: 1, 
            background: 'linear-gradient(145deg, rgba(168, 85, 247, 0.08) 0%, rgba(30, 30, 40, 0.95) 100%)',
            color: 'white', 
            borderRadius: 3, 
            boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
            border: '1px solid rgba(168, 85, 247, 0.2)',
            animation: 'slideIn 0.3s ease forwards',
            '@keyframes slideIn': {
              from: { opacity: 0, transform: 'translateX(-10px)' },
              to: { opacity: 1, transform: 'translateX(0)' },
            },
          }}>
            <Typography 
              variant="h5" 
              gutterBottom 
              sx={{ 
                color: 'white', 
                textAlign: 'center',
                fontWeight: 700,
                background: 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Adatbázis importálása
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(245, 158, 11, 1)', textAlign: 'center', maxWidth: 700, mx: 'auto', mb: 1, fontWeight: 500 }}>
              Az adatok az AI-nak lesznek átadva. Ne adjon meg semmilyen olyan kényes adatot, amit az interneten sem osztana meg!
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.75)', textAlign: 'center', maxWidth: 700, mx: 'auto' }}>
              FONTOS: Maximum 3 munkalap importálható, munkalaponként 1000 karakter hosszúságú.
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mt: 3 }}>
              <Button
                variant="contained"
                onClick={handleFileSelect}
                disabled={loading}
                sx={{ 
                  background: 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)',
                  color: '#fff', 
                  fontWeight: 600,
                  borderRadius: 2,
                  boxShadow: '0 4px 15px rgba(168, 85, 247, 0.3)',
                  transition: 'all 0.2s ease',
                  '&:hover': { 
                    background: 'linear-gradient(135deg, #c084fc 0%, #818cf8 100%)',
                    transform: 'translateY(-2px)',
                    boxShadow: '0 6px 20px rgba(168, 85, 247, 0.4)',
                  },
                  width: 220 
                }}
              >
                {loading ? <CircularProgress size={24} /> : 'Excel fájl kiválasztása'}
              </Button>

              {selectedFileName && (
                <Typography sx={{ mt: 2, color: 'white', wordBreak: 'break-all', maxWidth: 640, textAlign: 'center' }}>
                  Kiválasztott fájl: {selectedFileName}
                </Typography>
              )}

              {showConfirm && (
                <Paper sx={{ 
                  mt: 3, 
                  p: 3, 
                  background: 'rgba(30, 30, 40, 0.9)',
                  borderRadius: 2, 
                  maxWidth: 640, 
                  width: '100%', 
                  border: '1px solid rgba(168, 85, 247, 0.3)',
                  animation: 'scaleIn 0.2s ease forwards',
                  '@keyframes scaleIn': {
                    from: { opacity: 0, transform: 'scale(0.95)' },
                    to: { opacity: 1, transform: 'scale(1)' },
                  },
                }}>
                  <Typography sx={{ mb: 2, color: 'white', textAlign: 'center' }}>
                    Figyelem! A feltöltés felülírja a meglévő adatbázist. Biztosan szeretnéd folytatni?
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
                    <Button
                      variant="contained"
                      color="primary"
                      onClick={handleConfirm}
                      disabled={loading}
                      sx={{ 
                        background: 'linear-gradient(135deg, #22c55e 0%, #10b981 100%)',
                        color: '#fff',
                        fontWeight: 600,
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
                      sx={{ 
                        color: 'white', 
                        borderColor: 'rgba(255,255,255,0.3)',
                        '&:hover': {
                          borderColor: 'rgba(255,255,255,0.5)',
                          background: 'rgba(255,255,255,0.05)',
                        },
                      }}
                    >
                      Mégsem
                    </Button>
                  </Box>
                </Paper>
              )}

              {(originalUploadedFileName || uploadedFileName) && (
                <Box sx={{ mt: 2, maxWidth: 640, textAlign: 'center' }}>
                  <Typography sx={{ color: 'rgba(255,255,255,0.75)', wordBreak: 'break-all' }}>
                    Feltöltött fájl: {originalUploadedFileName || uploadedFileName}
                  </Typography>
                </Box>
              )}
            </Box>
          </Paper>
        )}

        {section === 'editor' && (
          // render the full SheetEditorView inline so the tab doesn't switch the whole app view
          <SheetEditorView showSnackbar={showSnackbar} embedded onClose={() => setSection('excel')} />
        )}

        {section === 'file_import' && (
         <Paper variant="outlined" sx={{ 
           p: 4, 
           mt: 1, 
           background: 'linear-gradient(145deg, rgba(34, 197, 94, 0.08) 0%, rgba(30, 30, 40, 0.95) 100%)',
           color: 'white', 
           borderRadius: 3, 
           boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
           border: '1px solid rgba(34, 197, 94, 0.2)',
           animation: 'slideIn 0.3s ease forwards',
           '@keyframes slideIn': {
             from: { opacity: 0, transform: 'translateX(-10px)' },
             to: { opacity: 1, transform: 'translateX(0)' },
           },
         }}>
            <Typography 
              variant="h5" 
              gutterBottom 
              sx={{ 
                color: 'white', 
                textAlign: 'center',
                fontWeight: 700,
                background: 'linear-gradient(135deg, #22c55e 0%, #10b981 100%)',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Mappa feltöltése
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.75)', textAlign: 'center', mb: 2 }}>Válassz ki egy mappát — a program feldolgozza a benne lévő .txt, .csv és .xlsx fájlokat, kinyeri a szöveget és előkészíti az AI-nak.</Typography>

            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
              <Button 
                variant="contained" 
                onClick={async () => {
                  try {
                    const res = await window.api.showDirectoryDialog?.();
                    if (res && res.success) {
                      setSelectedFileName(res.dirPath);
                    }
                  } catch (e) {
                    showSnackbar('Hiba a mappa kiválasztásakor', 'error');
                  }
                }} 
                disabled={loading} 
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
                    boxShadow: '0 6px 20px rgba(99, 102, 241, 0.4)',
                  },
                }}
              >
                Mappa kiválasztása
              </Button>

              <Button 
                variant="contained" 
                onClick={async () => {
                  if (!selectedFileName) return;
                  setSaving(true);
                  setImportProgress([]);
                  try {
                    const result = await window.api.importFolderForEmbeddings?.({ dirPath: selectedFileName });
                    if (result && result.success) {
                      showSnackbar(`Feltöltés kész.`, 'success');
                      setUploadedFilePath(result.embeddingsPath || '');
                    } else {
                      showSnackbar(`Hiba: ${result?.error || 'Ismeretlen hiba'}`, 'error');
                    }
                  } catch (e) {
                    console.error('Import error', e);
                    showSnackbar('Hiba történt a feltöltés során!', 'error');
                  } finally {
                    setSaving(false);
                  }
                }} 
                disabled={!selectedFileName || saving} 
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
                    boxShadow: '0 6px 20px rgba(34, 197, 94, 0.4)',
                  },
                }}
              >
                {saving ? 'Feltöltés...' : 'Feltöltés indítása'}
              </Button>
            </Box>

            {selectedFileName && (
              <Typography sx={{ mt: 2, color: 'rgba(255,255,255,0.85)', textAlign: 'center', wordBreak: 'break-all' }}>Kiválasztott mappa: {selectedFileName}</Typography>
            )}

            <Box sx={{ mt: 3 }}>
              <Typography sx={{ color: 'rgba(255,255,255,0.75)', mb: 1, fontWeight: 500 }}>Feldolgozás állapota:</Typography>
              <List sx={{ 
                maxHeight: 240, 
                overflowY: 'auto', 
                bgcolor: 'rgba(34, 197, 94, 0.05)', 
                borderRadius: 2,
                border: '1px solid rgba(34, 197, 94, 0.1)',
              }}>
                {importProgress.length === 0 && (
                  <ListItem>
                    <ListItemText primary={saving ? 'Várakozás...' : 'Nincs művelet még.'} primaryTypographyProps={{ sx: { color: 'rgba(255,255,255,0.6)' } }} />
                  </ListItem>
                )}
                {importProgress.map((p, idx) => (
                  <ListItem 
                    key={idx} 
                    sx={{ 
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      animation: `fadeIn 0.3s ease forwards ${idx * 0.05}s`,
                      opacity: 0,
                      '@keyframes fadeIn': {
                        to: { opacity: 1 },
                      },
                    }}
                  >
                    <ListItemText
                      primary={`${p.file ? p.file.split(/[/\\]/).pop() : 'file'} — ${p.status}${p.chunkIndex ? ` (chunk ${p.chunkIndex}/${p.totalChunks || '?'})` : ''}`}
                      primaryTypographyProps={{ sx: { color: 'white', fontSize: 13 } }}
                      secondary={p.error ? `Hiba: ${p.error}` : (p.reason ? p.reason : '')}
                      secondaryTypographyProps={{ sx: { color: 'rgba(255,255,255,0.6)', fontSize: 12 } }}
                    />
                  </ListItem>
                ))}
              </List>
            </Box>
          </Paper>
        )}
      </Box>
    </Paper>
  );
};

export default ImportFileView;