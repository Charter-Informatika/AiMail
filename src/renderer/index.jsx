window.global ||= window;

import React, { use, useEffect, useState } from "react";
import ReactDOM from 'react-dom/client';
import {
  Box,
  Typography,
  Paper,
  CircularProgress,
  Button,
  TextField,
  Snackbar,
  Alert,
  Checkbox,
  FormControlLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  Select,
  MenuItem,
  Card,
  CardContent,
  FormGroup,
  Switch,
  CssBaseline,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemText
} from '@mui/material';
import { createTheme, ThemeProvider, useTheme } from '@mui/material/styles';
import HomeView from './components/HomeView';
import ImportFileView from './components/ImportFileView';
import PromptView from './components/PromptView';
import SentMailsView from './components/SentMailsView';
import MailsView from './components/MailsView';
import SettingsView from './components/SettingsView';
import TutorialView from './components/TutorialView';
import DemoOverView from './components/DemoOverView';
import HelpView from './components/HelpView';
import NoConnectionView from './components/NoConnectionView.jsx';
import UpdateView from "./components/UpdateView.jsx";
import UpdateReadyView from "./components/UpdateReadyView.jsx";
import LicenceActivationView from './components/LicenceActivationView.jsx';
import SheetEditorView from './components/SheetEditorView';
import GeneratedMailsView from "./components/GeneratedMailsView.jsx";
import { FaRegQuestionCircle, FaThumbtack, FaHome, FaEnvelope, FaDatabase, FaRobot, FaCog, FaSignOutAlt, FaPowerOff, FaUserFriends } from 'react-icons/fa';
import { FaEnvelopeCircleCheck } from "react-icons/fa6";
import { BsFillEnvelopeArrowUpFill } from "react-icons/bs";
import { IoMdConstruct } from "react-icons/io";
import { FaTimesCircle } from "react-icons/fa";
import IconButton from '@mui/material/IconButton';

// Téma objektumok - Modern redesign with vibrant colors
const themes = {
  purple: createTheme({
    palette: {
      mode: 'dark',
      primary: { main: '#a855f7', light: '#c084fc', dark: '#7c3aed' },
      secondary: { main: '#ec4899', light: '#f472b6', dark: '#db2777' },
      background: { 
        default: '#0c0a1d', 
        paper: '#13102a'
      },
      text: { primary: '#f3e8ff', secondary: '#c4b5fd' },
      success: { main: '#22c55e', light: '#4ade80' },
      error: { main: '#ef4444', light: '#f87171' },
      warning: { main: '#f59e0b', light: '#fbbf24' },
      info: { main: '#3b82f6', light: '#60a5fa' },
    },
    typography: {
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      h4: { fontWeight: 600, letterSpacing: '-0.02em' },
      h5: { fontWeight: 600, letterSpacing: '-0.01em' },
      h6: { fontWeight: 600 },
      button: { fontWeight: 500, textTransform: 'none' },
    },
    shape: { borderRadius: 12 },
    components: {
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'linear-gradient(to bottom right, rgba(168, 85, 247, 0.05), rgba(236, 72, 153, 0.02))',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(168, 85, 247, 0.15)',
            transition: 'all 0.25s ease',
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 10,
            padding: '10px 20px',
            transition: 'all 0.2s ease',
            '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 4px 20px rgba(168, 85, 247, 0.35)' },
          },
          contained: {
            background: 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)',
            '&:hover': { background: 'linear-gradient(135deg, #c084fc 0%, #a855f7 100%)' },
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            background: 'linear-gradient(145deg, rgba(168, 85, 247, 0.1), rgba(19, 16, 42, 0.9))',
            border: '1px solid rgba(168, 85, 247, 0.2)',
            transition: 'all 0.3s ease',
            '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 8px 32px rgba(168, 85, 247, 0.25)' },
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              borderRadius: 10,
              transition: 'all 0.2s ease',
              '&:hover': { boxShadow: '0 0 0 2px rgba(168, 85, 247, 0.2)' },
              '&.Mui-focused': { boxShadow: '0 0 0 3px rgba(168, 85, 247, 0.3)' },
            },
          },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            transition: 'all 0.2s ease',
            '&:hover': { transform: 'scale(1.1)', background: 'rgba(168, 85, 247, 0.15)' },
          },
        },
      },
    },
    drawer: {
      gradient: 'linear-gradient(to right, #a855f7 50%, transparent)',
      shadow: '2px 0 16px 0 rgba(168, 85, 247, 0.4)',
      curtainGradient: 'linear-gradient(to right, #a855f7 80%, transparent)',
      triggerColor: '#c084fc',
    },
  }),
  black: createTheme({
    palette: {
      mode: 'dark',
      primary: { main: '#6366f1', light: '#818cf8', dark: '#4f46e5' },
      secondary: { main: '#fbbf24', light: '#fcd34d', dark: '#f59e0b' },
      background: { 
        default: '#09090b', 
        paper: '#18181b'
      },
      text: { primary: '#fafafa', secondary: '#a1a1aa' },
      success: { main: '#22c55e', light: '#4ade80' },
      error: { main: '#ef4444', light: '#f87171' },
      warning: { main: '#f59e0b', light: '#fbbf24' },
      info: { main: '#3b82f6', light: '#60a5fa' },
    },
    typography: {
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      h4: { fontWeight: 600, letterSpacing: '-0.02em' },
      h5: { fontWeight: 600, letterSpacing: '-0.01em' },
      h6: { fontWeight: 600 },
      button: { fontWeight: 500, textTransform: 'none' },
    },
    shape: { borderRadius: 12 },
    components: {
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'linear-gradient(to bottom right, rgba(99, 102, 241, 0.03), rgba(24, 24, 27, 0.95))',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            transition: 'all 0.25s ease',
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 10,
            padding: '10px 20px',
            transition: 'all 0.2s ease',
            '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 4px 20px rgba(99, 102, 241, 0.35)' },
          },
          contained: {
            background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
            '&:hover': { background: 'linear-gradient(135deg, #818cf8 0%, #6366f1 100%)' },
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            background: 'linear-gradient(145deg, rgba(99, 102, 241, 0.08), rgba(24, 24, 27, 0.95))',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            transition: 'all 0.3s ease',
            '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 8px 32px rgba(99, 102, 241, 0.2)' },
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              borderRadius: 10,
              transition: 'all 0.2s ease',
              '&:hover': { boxShadow: '0 0 0 2px rgba(99, 102, 241, 0.2)' },
              '&.Mui-focused': { boxShadow: '0 0 0 3px rgba(99, 102, 241, 0.3)' },
            },
          },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            transition: 'all 0.2s ease',
            '&:hover': { transform: 'scale(1.1)', background: 'rgba(99, 102, 241, 0.15)' },
          },
        },
      },
    },
    drawer: {
      gradient: 'linear-gradient(to right, #6366f1 50%, transparent)',
      shadow: '2px 0 16px 0 rgba(99, 102, 241, 0.3)',
      curtainGradient: 'linear-gradient(to right, #6366f1 80%, transparent)',
      triggerColor: '#818cf8',
    },
  }),
  light: createTheme({
    palette: {
      mode: 'light',
      primary: { main: '#6366f1', light: '#818cf8', dark: '#4f46e5' },
      secondary: { main: '#ec4899', light: '#f472b6', dark: '#db2777' },
      background: { 
        default: '#f8fafc', 
        paper: '#ffffff'
      },
      text: { primary: '#1e293b', secondary: '#64748b' },
      success: { main: '#22c55e', light: '#4ade80' },
      error: { main: '#ef4444', light: '#f87171' },
      warning: { main: '#f59e0b', light: '#fbbf24' },
      info: { main: '#3b82f6', light: '#60a5fa' },
    },
    typography: {
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      h4: { fontWeight: 600, letterSpacing: '-0.02em' },
      h5: { fontWeight: 600, letterSpacing: '-0.01em' },
      h6: { fontWeight: 600 },
      button: { fontWeight: 500, textTransform: 'none' },
    },
    shape: { borderRadius: 12 },
    components: {
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
            border: '1px solid rgba(0, 0, 0, 0.06)',
            transition: 'all 0.25s ease',
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 10,
            padding: '10px 20px',
            transition: 'all 0.2s ease',
            '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 4px 20px rgba(99, 102, 241, 0.25)' },
          },
          contained: {
            background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
            '&:hover': { background: 'linear-gradient(135deg, #818cf8 0%, #6366f1 100%)' },
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            background: '#ffffff',
            border: '1px solid rgba(0, 0, 0, 0.08)',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.06)',
            transition: 'all 0.3s ease',
            '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 8px 32px rgba(99, 102, 241, 0.15)' },
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              borderRadius: 10,
              transition: 'all 0.2s ease',
              '&:hover': { boxShadow: '0 0 0 2px rgba(99, 102, 241, 0.15)' },
              '&.Mui-focused': { boxShadow: '0 0 0 3px rgba(99, 102, 241, 0.2)' },
            },
          },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            transition: 'all 0.2s ease',
            '&:hover': { transform: 'scale(1.1)', background: 'rgba(99, 102, 241, 0.1)' },
          },
        },
      },
    },
    drawer: {
      gradient: 'linear-gradient(to right, #6366f1 50%, transparent)',
      shadow: '2px 0 16px 0 rgba(99, 102, 241, 0.2)',
      curtainGradient: 'linear-gradient(to right, #6366f1 80%, transparent)',
      triggerColor: '#818cf8',
    },
  }),
  red: createTheme({
    palette: {
      mode: 'dark',
      primary: { main: '#ef4444', light: '#f87171', dark: '#dc2626' },
      secondary: { main: '#f97316', light: '#fb923c', dark: '#ea580c' },
      background: { 
        default: '#0f0a0a', 
        paper: '#1c1414'
      },
      text: { primary: '#fef2f2', secondary: '#fca5a5' },
      success: { main: '#22c55e', light: '#4ade80' },
      error: { main: '#ef4444', light: '#f87171' },
      warning: { main: '#f59e0b', light: '#fbbf24' },
      info: { main: '#3b82f6', light: '#60a5fa' },
    },
    typography: {
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      h4: { fontWeight: 600, letterSpacing: '-0.02em' },
      h5: { fontWeight: 600, letterSpacing: '-0.01em' },
      h6: { fontWeight: 600 },
      button: { fontWeight: 500, textTransform: 'none' },
    },
    shape: { borderRadius: 12 },
    components: {
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'linear-gradient(to bottom right, rgba(239, 68, 68, 0.05), rgba(28, 20, 20, 0.95))',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(239, 68, 68, 0.15)',
            transition: 'all 0.25s ease',
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 10,
            padding: '10px 20px',
            transition: 'all 0.2s ease',
            '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 4px 20px rgba(239, 68, 68, 0.35)' },
          },
          contained: {
            background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
            '&:hover': { background: 'linear-gradient(135deg, #f87171 0%, #ef4444 100%)' },
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            background: 'linear-gradient(145deg, rgba(239, 68, 68, 0.08), rgba(28, 20, 20, 0.95))',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            transition: 'all 0.3s ease',
            '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 8px 32px rgba(239, 68, 68, 0.25)' },
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              borderRadius: 10,
              transition: 'all 0.2s ease',
              '&:hover': { boxShadow: '0 0 0 2px rgba(239, 68, 68, 0.2)' },
              '&.Mui-focused': { boxShadow: '0 0 0 3px rgba(239, 68, 68, 0.3)' },
            },
          },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            transition: 'all 0.2s ease',
            '&:hover': { transform: 'scale(1.1)', background: 'rgba(239, 68, 68, 0.15)' },
          },
        },
      },
    },
    drawer: {
      gradient: 'linear-gradient(to right, #ef4444 50%, transparent)',
      shadow: '2px 0 16px 0 rgba(239, 68, 68, 0.4)',
      curtainGradient: 'linear-gradient(to right, #ef4444 80%, transparent)',
      triggerColor: '#f87171',
    },
  }),
  blue: createTheme({
    palette: {
      mode: 'dark',
      primary: { main: '#3b82f6', light: '#60a5fa', dark: '#2563eb' },
      secondary: { main: '#06b6d4', light: '#22d3ee', dark: '#0891b2' },
      background: { 
        default: '#0a0f1a', 
        paper: '#111827'
      },
      text: { primary: '#f0f9ff', secondary: '#93c5fd' },
      success: { main: '#22c55e', light: '#4ade80' },
      error: { main: '#ef4444', light: '#f87171' },
      warning: { main: '#f59e0b', light: '#fbbf24' },
      info: { main: '#3b82f6', light: '#60a5fa' },
    },
    typography: {
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      h4: { fontWeight: 600, letterSpacing: '-0.02em' },
      h5: { fontWeight: 600, letterSpacing: '-0.01em' },
      h6: { fontWeight: 600 },
      button: { fontWeight: 500, textTransform: 'none' },
    },
    shape: { borderRadius: 12 },
    components: {
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'linear-gradient(to bottom right, rgba(59, 130, 246, 0.05), rgba(17, 24, 39, 0.95))',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(59, 130, 246, 0.15)',
            transition: 'all 0.25s ease',
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 10,
            padding: '10px 20px',
            transition: 'all 0.2s ease',
            '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 4px 20px rgba(59, 130, 246, 0.35)' },
          },
          contained: {
            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
            '&:hover': { background: 'linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%)' },
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            background: 'linear-gradient(145deg, rgba(59, 130, 246, 0.08), rgba(17, 24, 39, 0.95))',
            border: '1px solid rgba(59, 130, 246, 0.2)',
            transition: 'all 0.3s ease',
            '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 8px 32px rgba(59, 130, 246, 0.25)' },
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              borderRadius: 10,
              transition: 'all 0.2s ease',
              '&:hover': { boxShadow: '0 0 0 2px rgba(59, 130, 246, 0.2)' },
              '&.Mui-focused': { boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.3)' },
            },
          },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            transition: 'all 0.2s ease',
            '&:hover': { transform: 'scale(1.1)', background: 'rgba(59, 130, 246, 0.15)' },
          },
        },
      },
    },
    drawer: {
      gradient: 'linear-gradient(to right, #3b82f6 50%, transparent)',
      shadow: '2px 0 16px 0 rgba(59, 130, 246, 0.4)',
      curtainGradient: 'linear-gradient(to right, #3b82f6 80%, transparent)',
      triggerColor: '#60a5fa',
    },
  }),
};

const ExitDialog = ({ open, onClose, onConfirm }) => {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-description"
      PaperProps={{
        sx: {
          backgroundColor: 'background.paper',
          color: 'text.primary',
          '& .MuiDialogContent-root': {
            backgroundColor: 'background.paper'
          },
          '& .MuiDialogActions-root': {
            backgroundColor: 'background.paper'
          }
        }
      }}
    >
      <DialogTitle id="alert-dialog-title" sx={{ color: 'text.primary', backgroundColor: 'background.paper' }}>
        Biztosan ki szeretne lépni?
      </DialogTitle>
      <DialogActions>
        <Button onClick={onClose} color="primary">
          Mégsem
        </Button>
        <Button onClick={onConfirm} color="primary" variant="contained" autoFocus>
          Kilépés
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const LogoutDialog = ({ open, onClose, onConfirm }) => {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-description"
      PaperProps={{
        sx: {
          backgroundColor: 'background.paper',
          color: 'text.primary',
          '& .MuiDialogContent-root': {
            backgroundColor: 'background.paper'
          },
          '& .MuiDialogActions-root': {
            backgroundColor: 'background.paper'
          }
        }
      }}
    >
      <DialogTitle id="alert-dialog-title" sx={{ color: 'text.primary', backgroundColor: 'background.paper' }}>
        Biztosan kijelentkezik?
      </DialogTitle>
      <DialogActions>
        <Button onClick={onClose} color="primary">
          Mégsem
        </Button>
        <Button onClick={onConfirm} color="primary" variant="contained" autoFocus>
          Kijelentkezés
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const SmtpSettingsDialog = ({ open, onClose, onSubmit, loading }) => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    imapHost: '',
    imapPort: '993',
    smtpHost: '',
    smtpPort: '587',
    useSSL: true
  });

  const handleChange = (field) => (event) => {
    setFormData(prev => ({
      ...prev,
      [field]: field === 'useSSL' ? event.target.checked : event.target.value
    }));
  };

  const handleSubmit = () => {
    onSubmit(formData);
  };

  const isFormValid = () => {
    return formData.email && 
           formData.password && 
           formData.imapHost && 
           formData.imapPort && 
           formData.smtpHost && 
           formData.smtpPort;
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Email fiók beállítások</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
          <TextField
            label="Email cím"
            value={formData.email}
            onChange={handleChange('email')}
            fullWidth
            required
          />
          <TextField
            label="Jelszó"
            type="password"
            value={formData.password}
            onChange={handleChange('password')}
            fullWidth
            required
          />
          <TextField
            label="IMAP Szerver"
            value={formData.imapHost}
            onChange={handleChange('imapHost')}
            fullWidth
            required
            placeholder="pl.: imap.gmail.com"
          />
          <TextField
            label="IMAP Port"
            value={formData.imapPort}
            onChange={handleChange('imapPort')}
            fullWidth
            required
          />
          <TextField
            label="SMTP Szerver"
            value={formData.smtpHost}
            onChange={handleChange('smtpHost')}
            fullWidth
            required
            placeholder="pl.: smtp.gmail.com"
          />
          <TextField
            label="SMTP Port"
            value={formData.smtpPort}
            onChange={handleChange('smtpPort')}
            fullWidth
            required
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={formData.useSSL}
                onChange={handleChange('useSSL')}
              />
            }
            label="SSL/TLS használata"
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Mégsem</Button>
        <Button 
          onClick={handleSubmit} 
          variant="contained" 
          disabled={!isFormValid() || loading}
        >
          {loading ? <CircularProgress size={24} /> : 'Csatlakozás'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const LoginView = ({ onLogin, showSnackbar }) => {
  const [selectedProvider, setSelectedProvider] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSmtpDialog, setShowSmtpDialog] = useState(false);

  const handleProviderSelect = async (provider) => {
    setSelectedProvider(provider);
    if (provider === 'smtp') {
      setShowSmtpDialog(true);
      return;
    }

    setLoading(true);
    try {
      let success = false;
      let email = '';
      if (provider === 'gmail') {
        success = await window.api.loginWithGmail();
        // Próbáljuk lekérni az email címet is, ha van ilyen API
        if (success && window.api.getCurrentUserEmail) {
          try {
            email = await window.api.getCurrentUserEmail();
          } catch (e) { email = ''; }
        }
      }
      if (success) {
        showSnackbar('Sikeres bejelentkezés!', 'success');
        onLogin(provider, email); // Átadjuk az emailt is
      }
    } catch (error) {
      showSnackbar('Hiba történt a bejelentkezés során!', 'error');
      console.error('Bejelentkezési hiba:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSmtpSubmit = async (formData) => {
    setLoading(true);
    try {
      const success = await window.api.loginWithSmtp(formData);
      if (success) {
        showSnackbar('Sikeres bejelentkezés!', 'success');
        setShowSmtpDialog(false);
        onLogin('smtp', formData.email); // Átadjuk az emailt is
      } else {
        showSnackbar('Sikertelen bejelentkezés!', 'error');
      }
    } catch (error) {
      showSnackbar('Hiba történt a bejelentkezés során!', 'error');
      console.error('SMTP bejelentkezési hiba:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '80vh',
      gap: 4
    }}>
      <Typography variant="h4" gutterBottom>
        Válasszon ki egy email címet a levelezés elkezdéséhez
      </Typography>
      <Box sx={{ 
        display: 'flex', 
        gap: 2, 
        flexWrap: 'wrap',
        justifyContent: 'center',
        maxWidth: 1000
      }}>
        <Card sx={{ width: 300, cursor: 'pointer' }} onClick={() => handleProviderSelect('gmail')}>
          <CardContent>
            <Typography variant="h6" gutterBottom>Gmail</Typography>
            <Typography>
              Bejelentkezés Google fiókkal
            </Typography>
          </CardContent>
        </Card>
        <Card sx={{ width: 300, cursor: 'pointer' }} onClick={() => handleProviderSelect('smtp')}>
          <CardContent>
            <Typography variant="h6" gutterBottom>Egyéb (SMTP/IMAP)</Typography>
            <Typography>
              Bejelentkezés egyéb email fiókkal
            </Typography>
          </CardContent>
        </Card>
      </Box>
      {loading && !showSmtpDialog && <CircularProgress sx={{ mt: 4 }} />}

      <SmtpSettingsDialog
        open={showSmtpDialog}
        onClose={() => setShowSmtpDialog(false)}
        onSubmit={handleSmtpSubmit}
        loading={loading}
      />
    </Box>
  );
};


const AutoSendConfirmDialog = ({ open, onClose, onConfirm, startTime, endTime, onTimeChange, timedAutoSend, onTimedAutoSendChange }) => (
  <Dialog open={open} onClose={onClose}>
    <DialogTitle>Automatikus válaszküldés bekapcsolása</DialogTitle>
    <DialogContent>
      <DialogContentText>
        Biztosan be szeretné kapcsolni az automatikus válasz küldést? A rendszer automatikusan fog válaszolni az ÖSSZES olvasatlan levélre.
      </DialogContentText>
      <Box sx={{ mt: 3 }}>
        <FormControlLabel
          control={<Switch checked={timedAutoSend} onChange={onTimedAutoSendChange} />}
          label="Időzített automatikus válaszküldés"
        />
        {timedAutoSend && (
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mt: 2 }}>
            <TextField
              label="Kezdő időpont"
              type="time"
              value={startTime}
              onChange={onTimeChange('start')}
              sx={{ width: 150 }}
            />
            <Typography sx={{ mx: 2 }}>-</Typography>
            <TextField
              label="Befejező időpont"
              type="time"
              value={endTime}
              onChange={onTimeChange('end')}
              sx={{ width: 150 }}
            />
          </Box>
        )}
      </Box>
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose}>Mégsem</Button>
      <Button onClick={onConfirm} variant="contained" autoFocus>Bekapcsolás</Button>
    </DialogActions>
  </Dialog>
);

const App = () => {
  // MINDEN HOOK ITT!
  const [isDemoOver, setIsDemoOver] = useState(false);
  const [themeName, setThemeName] = useState(() => {
    return localStorage.getItem('themeName') || 'black';
  });
  // ...többi useState, useEffect...
  // Az activeView állapotot localStorage-ból olvassuk ki, ha van mentett érték
  const [activeView, setActiveView] = useState(('home'));
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('success');
  const [exitDialogOpen, setExitDialogOpen] = useState(false);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  // Indicates whether we've completed the initial async auth check
  const [authChecked, setAuthChecked] = useState(false);
  const [isLeftNavbarOn, setIsLeftNavbarOn] = useState(true);
  const [isPinned, setIsPinned] = useState(true); // alapból true
  const [drawerOpen, setDrawerOpen] = useState(true); // alapból true
  const [isOnline, setIsOnline] = useState(true); // ÚJ: internet állapot
  const [autoSend, setAutoSend] = useState(false);
  const [halfAuto, setHalfAuto] = useState(false); 
  const [isLicenced, setIsLicenced] = useState(() => {
    return localStorage.getItem('isLicenced') === 'true';
  }); // ÚJ: licenc állapot
  const [showAutoSendDialog, setShowAutoSendDialog] = useState(false);
  const [pendingAutoSend, setPendingAutoSend] = useState(false);
  const [timedAutoSend, setTimedAutoSend] = useState(true);
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("16:00");
  const [updateProgress, setUpdateProgress] = useState(null);
  const [updateStatus, setUpdateStatus] = useState(null);

  // Navbar állapot inicializálása settingsből
  useEffect(() => {
    window.api.getLeftNavbarMode?.().then((on) => {
      setIsLeftNavbarOn(on ?? true);
      setIsPinned(on ?? true);
      setDrawerOpen(on ?? true);
    });
  }, []);

  // drawerOpen vagy isPinned változásakor is szinkronizáljuk:
  useEffect(() => {
    setIsLeftNavbarOn(isPinned || drawerOpen);
    window.api.setLeftNavbarMode?.(isPinned || drawerOpen);
  }, [isPinned, drawerOpen]);

  // A tutorial állapotot localStorage-ból olvassuk ki, ha már egyszer átlépte vagy bejelentkezett a felhasználó
  const [isTutorialShown, setIsTutorialShown] = useState(() => {
    return localStorage.getItem('isTutorialShown') === 'true';
  });
  const [emailProvider, setEmailProvider] = useState(null);
  const [userEmail, setUserEmail] = useState(''); // ÚJ: email state
  const [search, setSearch] = useState('');


  // Mentés localStorage-ba, ha activeView változik
  useEffect(() => {
    localStorage.setItem('activeView', activeView);
  }, [activeView]);

  const theme = useTheme();

  useEffect(() => {
    localStorage.setItem('themeName', themeName);
  }, [themeName]);

  // Hover logic
  const handleDrawerMouseEnter = () => {
    if (!isPinned) setDrawerOpen(true);
  };
  const handleDrawerMouseLeave = () => {
    if (!isPinned) setDrawerOpen(false);
  };
  const handlePinClick = () => {
    setIsPinned((prev) => {
      const newPinned = !prev;
      if (newPinned) {
        setDrawerOpen(true); // Pin -> mindig nyitva
      } else {
        setDrawerOpen(false); // Unpin -> zárjuk
      }
      setIsLeftNavbarOn(newPinned || drawerOpen);
      return newPinned;
    });
  };

  // Ellenőrizzük, hogy van-e mentett bejelentkezés
  useEffect(() => {
    window.api.checkAuthStatus()
      .then(status => {
        if (status.isAuthenticated) {
          setIsAuthenticated(true);
          setEmailProvider(status.provider);
          if (status.email) setUserEmail(status.email); // ÚJ: email beállítása, ha van
          // Ha már bejelentkezett, a tutorialt soha többé ne mutassuk
          if (!isTutorialShown) {
            setIsTutorialShown(true);
            localStorage.setItem('isTutorialShown', 'true');
          }
        } else {
          setIsAuthenticated(false);
          setEmailProvider(null);
          setUserEmail(''); // ÚJ: email törlése
        }
        // Mark that we've finished checking auth (success path)
        setAuthChecked(true);
      })
      .catch(error => {
        console.error('Hiba az authentikáció ellenőrzésekor:', error);
        setIsAuthenticated(false);
        setEmailProvider(null);
        setUserEmail(''); // ÚJ: email törlése
        // Mark that we've finished checking auth (error path)
        setAuthChecked(true);
      });
  }, []);

  const handleLogin = (provider, email) => {
    setIsAuthenticated(true);
    setEmailProvider(provider);
    setUserEmail(email || ''); // ÚJ: email beállítása
    // Ha bejelentkezett, a tutorialt soha többé ne mutassuk
    if (!isTutorialShown) {
      setIsTutorialShown(true);
      localStorage.setItem('isTutorialShown', 'true');
    }
  };

  const handleLogoutClick = () => {
    setLogoutDialogOpen(true);
  };

  const handleLogoutConfirm = async () => {
    try {
      await window.api.logout();
      try {
        localStorage.removeItem('uploadedFileName');
        localStorage.removeItem('originalUploadedFileName');
        localStorage.removeItem('previousUploadedFileName');
        localStorage.removeItem('activeView');
      } catch (e) {
        console.warn('localStorage törlés hiba:', e);
      }
      
      setIsAuthenticated(false);
      setEmailProvider(null);
      setUserEmail(''); 
      setLogoutDialogOpen(false);
      showSnackbar('Sikeres kijelentkezés!', 'success');
    } catch (error) {
      showSnackbar('Hiba történt a kijelentkezés során!', 'error');
      console.error('Kijelentkezési hiba:', error);
    }
  };

  const handleLogoutCancel = () => {
    setLogoutDialogOpen(false);
  };

  const handleExitClick = () => {
    setExitDialogOpen(true);
  };

  const handleExitConfirm = () => {
    window.api.exitApp();
  };

  const handleExitCancel = () => {
    setExitDialogOpen(false);
  };

  // AutoSend állapot lekérdezése indításkor ÉS dinamikus frissítés
  useEffect(() => {
    let unsub = null;
    // Első lekérdezés
    window.api.getAutoSend?.().then(val => setAutoSend(!!val));
    // Dinamikus frissítés, ha van ilyen event
    if (window.api.onAutoSendChanged) {
      const handler = (val) => setAutoSend(!!val);
      window.api.onAutoSendChanged(handler);
      unsub = () => window.api.onAutoSendChanged(null);
    } else if (window.api.subscribeAutoSendChanged) {
      // Alternatív API támogatás
      unsub = window.api.subscribeAutoSendChanged((val) => setAutoSend(!!val));
    }
    return () => {
      if (unsub) unsub();
    };
  }, []);

  useEffect(() => {
  let unsub = null;
  // Első lekérdezés
  window.api.getHalfAutoSend?.().then(val => setHalfAuto(!!val));
  // Dinamikus frissítés, ha van ilyen event
  if (window.api.onHalfAutoSendChanged) {
    const handler = (val) => setHalfAuto(!!val);
    window.api.onHalfAutoSendChanged(handler);
    unsub = () => window.api.onHalfAutoSendChanged(null);
  } else if (window.api.subscribeHalfAutoSendChanged) {
    // Alternatív API támogatás
    unsub = window.api.subscribeHalfAutoSendChanged((val) => setHalfAuto(!!val));
  }
  return () => {
    if (unsub) unsub();
  };
  }, []);

  const handleAutoSendSwitch = (event) => {
    const checked = event.target.checked;
    if (checked) {
      setPendingAutoSend(true);
      setShowAutoSendDialog(true);
    } else {
      setAutoSend(false);
      window.api.setAutoSend(false).then(() => {
        window.api.onAutoSendChanged?.(false);
      });
    }
  };

  const handleConfirmAutoSend = () => {
      setAutoSend(true);
      window.api.setAutoSend(true).then(() => {
          window.api.onAutoSendChanged?.(true);
      });

      if (!timedAutoSend) {
          // Ha az időzített automatikus válaszküldés nincs bekapcsolva, állítsuk az időintervallumot 00:00-tól 23:59-ig
          setStartTime("00:00");
          setEndTime("23:59");
          window.api.setAutoSendTimes?.({ startTime: "00:00", endTime: "23:59" });
      } else {
          window.api.setTimedAutoSend && window.api.setTimedAutoSend(timedAutoSend);
      }

      setShowAutoSendDialog(false);
      setPendingAutoSend(false);
  };

  const handleCancelAutoSend = () => {
    setShowAutoSendDialog(false);
    setPendingAutoSend(false);
  };

  const handleTimeChange = (type) => (event) => {
    const newTime = event.target.value;
    if (type === 'start') {
      setStartTime(newTime);
      window.api.setAutoSendTimes?.({ startTime: newTime, endTime });
    } else {
      setEndTime(newTime);
      window.api.setAutoSendTimes?.({ startTime, endTime: newTime });
    }
  };

  const handleTimedAutoSendChange = (event) => {
    setTimedAutoSend(event.target.checked);
    window.api.setTimedAutoSend && window.api.setTimedAutoSend(event.target.checked);
  };

  useEffect(() => {
    const handleUpdateAvailable = () => {
      console.log('Update available!');
      setUpdateStatus('available');
      setActiveView('updateAvailable');
    };

    const handleUpdateReady = () => {
      console.log('Update ready!');
      setUpdateStatus('ready');
      setActiveView('updateReady');
    };

    window.api.onUpdateAvailable(handleUpdateAvailable);
    window.api.onUpdateReady(handleUpdateReady);

    return () => {
      window.api.removeUpdateDownloadProgressListener(handleUpdateAvailable);
      window.api.removeUpdateDownloadProgressListener(handleUpdateReady);
    };
  }, []);

  useEffect(() => {
    const handleSetView = (view) => {
      setActiveView(view);
    };

    window.api.receive('set-view', handleSetView);

    return () => {
      window.api.remove('set-view', handleSetView);
    };
  }, []);

  const renderView = () => {
    switch (activeView) {
      case 'updateAvailable': return <UpdateView />;
  case 'updateReady': return <UpdateReadyView onClose={() => { setActiveView('home'); setUpdateStatus(''); }} />;
      case 'generatedMails': return <GeneratedMailsView showSnackbar={showSnackbar} />;
      case 'mails': return <MailsView showSnackbar={showSnackbar} />;
      case 'sentMails': return <SentMailsView showSnackbar={showSnackbar} />;
      case 'mailStructure': return <MailStructureView showSnackbar={showSnackbar} />;
      case 'settings': return <SettingsView themeName={themeName} setThemeName={setThemeName} onAutoSendChanged={setAutoSend} onHalfAutoSendChanged={setHalfAuto} />;
      case 'import': return <ImportFileView showSnackbar={showSnackbar} />;
      case 'sheet-editor': return <SheetEditorView showSnackbar={showSnackbar} />;
      case 'prompt': return <PromptView showSnackbar={showSnackbar} />;
      case 'help': return <HelpView showSnackbar={showSnackbar} />;
      case 'home': return <HomeView showSnackbar={showSnackbar} reloadKey={activeView} />;
      default: return null;
    }
  };

  const showSnackbar = (message, severity = 'success') => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  };


  // OFFLINE nézet minden más előtt
  useEffect(() => {
    const ipc = window.electron?.ipcRenderer;
    const handleOffline = () => setIsOnline(false);
    const handleOnline = () => setIsOnline(true);

    const addListener = (channel, fn) => {
      if (!ipc) return;
      if (typeof ipc.on === 'function') ipc.on(channel, fn);
      else if (typeof ipc.addListener === 'function') ipc.addListener(channel, fn);
    };
    const removeListener = (channel, fn) => {
      if (!ipc) return;
      if (typeof ipc.removeListener === 'function') ipc.removeListener(channel, fn);
      else if (typeof ipc.off === 'function') ipc.off(channel, fn);
    };

    addListener('no-internet-connection', handleOffline);
    addListener('internet-connection-restored', handleOnline);

    // Browser/Electron fallback
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    // Kezdő állapot ellenőrzése
    window.api.checkInternet?.().then(ok => setIsOnline(!!ok));

    // Ha offline leszünk, 10 mp-enként újra próbáljuk
    let retryInterval = null;
    if (!isOnline) {
      retryInterval = setInterval(() => {
        window.api.checkInternet?.().then(ok => {
          if (ok) {
            setIsOnline(true);
          }
        });
      }, 10000);
    }

    return () => {
      removeListener('no-internet-connection', handleOffline);
      removeListener('internet-connection-restored', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
      if (retryInterval) clearInterval(retryInterval);
    };
  }, [isOnline]);

  // Demo állapot folyamatos ellenőrzése
  useEffect(() => {
    let cancelled = false;
    const checkDemoOver = async () => {
      try {
        const over = await window.api.isDemoOver();
        if (!cancelled) setIsDemoOver(over);
      } catch (e) {
        if (!cancelled) setIsDemoOver(false);
      }
    };
    checkDemoOver();
    const interval = setInterval(checkDemoOver, 5000); // 5 másodpercenként ellenőriz
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (!isOnline) {
    const retryConnection = async () => {
      const ok = await window.api.checkInternet?.();
      setIsOnline(!!ok);
    };
    return (
      <ThemeProvider theme={themes[themeName] || themes.black}>
        <CssBaseline />
        <Box sx={{ p: 4 }}>
          <NoConnectionView onRetry={retryConnection} />
        </Box>
      </ThemeProvider>
    );
  }
  // If we haven't finished checking auth yet, show a neutral loading screen to avoid
  // flashing the Login/Tutorial/Licence screens briefly on startup.
  if (!authChecked) {
    return (
      <ThemeProvider theme={themes[themeName] || themes.black}>
        <CssBaseline />
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
          <CircularProgress />
        </Box>
      </ThemeProvider>
    );
  }

  if (!isLicenced && !isDemoOver && !isAuthenticated) {
    return (
      <ThemeProvider theme={themes[themeName] || themes.black}>
        <CssBaseline />
        <LicenceActivationView /*onActivate={handleActivate}*/ />
      </ThemeProvider>
    );
  }

  // Ha a demo véget ért, csak a DemoOverView-t jelenítjük meg, minden más logikát kihagyva
  if (isDemoOver) {
    return (
      <ThemeProvider theme={themes[themeName] || themes.black}>
        <CssBaseline />
        <DemoOverView />
      </ThemeProvider>
    );
  }

  if (!isAuthenticated && isTutorialShown) {
    return (
      <ThemeProvider theme={themes[themeName] || themes.black}>
        <CssBaseline />
        <LoginView onLogin={handleLogin} showSnackbar={showSnackbar} />
        <Snackbar
          open={snackbarOpen}
          autoHideDuration={4000}
          onClose={() => setSnackbarOpen(false)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert onClose={() => setSnackbarOpen(false)} severity={snackbarSeverity} sx={{ width: '100%' }}>
            {snackbarMessage}
          </Alert>
        </Snackbar>
      </ThemeProvider>
    );
  }

  if (!isAuthenticated && !isTutorialShown) {
    return (
      <ThemeProvider theme={themes[themeName] || themes.black}>
        <CssBaseline />
        <TutorialView onSkip={() => {
          setIsTutorialShown(true);
          localStorage.setItem('isTutorialShown', 'true');
        }} />
      </ThemeProvider>
    );
  }

  if (updateStatus === 'available') {
    return (
      <ThemeProvider theme={themes[themeName] || themes.black}>
        <CssBaseline />
        <UpdateView/>
      </ThemeProvider>
    );
  }
  if (updateStatus === 'ready') {
    return (
      <ThemeProvider theme={themes[themeName] || themes.black}>
        <CssBaseline />
        <UpdateReadyView onClose={() => {setActiveView('home'); setUpdateStatus('')}} />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={themes[themeName] || themes.black}>
      <CssBaseline />
      {/* Felső navigációs sáv */}
      <Box
        sx={{
          width: '100vw',
          height: 64,
          backgroundColor: 'background.paper',
          display: 'flex',
          alignItems: 'center',
          position: 'fixed',
          top: 0,
          left: 0,
          zIndex: 1400,
          px: 4,
          position: 'relative',
        }}
      >
        {/* Középre pontosan igazított ikonok */}
        <Box sx={{ 
          display: 'flex', 
          gap: 1, 
          position: 'absolute', 
          left: '50%', 
          transform: 'translateX(-50%)',
          background: 'rgba(99, 102, 241, 0.08)',
          borderRadius: 3,
          p: 1,
          border: '1px solid rgba(99, 102, 241, 0.15)',
        }}>
          <IconButton 
            onClick={() => setActiveView('home')} 
            sx={{ 
              color: activeView === 'home' ? 'primary.main' : 'text.secondary',
              background: activeView === 'home' ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
              transition: 'all 0.2s ease',
              '&:hover': { 
                background: 'rgba(99, 102, 241, 0.2)',
                transform: 'translateY(-2px)',
              },
            }}
          >
            <FaHome size={20} />
          </IconButton>
          <IconButton 
            onClick={() => setActiveView('mails')} 
            sx={{ 
              color: activeView === 'mails' ? 'primary.main' : 'text.secondary',
              background: activeView === 'mails' ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
              transition: 'all 0.2s ease',
              '&:hover': { 
                background: 'rgba(99, 102, 241, 0.2)',
                transform: 'translateY(-2px)',
              },
            }}
          >
            <FaEnvelope size={20} />
          </IconButton>
          <IconButton 
            onClick={() => setActiveView('sentMails')} 
            sx={{ 
              color: activeView === 'sentMails' ? 'primary.main' : 'text.secondary',
              background: activeView === 'sentMails' ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
              transition: 'all 0.2s ease',
              '&:hover': { 
                background: 'rgba(99, 102, 241, 0.2)',
                transform: 'translateY(-2px)',
              },
            }}
          >
            <FaEnvelopeCircleCheck size={24} />
          </IconButton>
          <IconButton 
            onClick={() => setActiveView('generatedMails')} 
            sx={{ 
              color: activeView === 'generatedMails' ? 'primary.main' : 'text.secondary',
              background: activeView === 'generatedMails' ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
              transition: 'all 0.2s ease',
              '&:hover': { 
                background: 'rgba(99, 102, 241, 0.2)',
                transform: 'translateY(-2px)',
              },
            }}
          >
            <BsFillEnvelopeArrowUpFill size={20} />
          </IconButton>
          <IconButton 
            onClick={() => setActiveView('prompt')} 
            sx={{ 
              color: activeView === 'prompt' ? 'primary.main' : 'text.secondary',
              background: activeView === 'prompt' ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
              transition: 'all 0.2s ease',
              '&:hover': { 
                background: 'rgba(99, 102, 241, 0.2)',
                transform: 'translateY(-2px)',
              },
            }}
          >
            <IoMdConstruct size={20} />
          </IconButton>
          <IconButton 
            onClick={() => setActiveView('import')} 
            sx={{ 
              color: activeView === 'import' ? 'primary.main' : 'text.secondary',
              background: activeView === 'import' ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
              transition: 'all 0.2s ease',
              '&:hover': { 
                background: 'rgba(99, 102, 241, 0.2)',
                transform: 'translateY(-2px)',
              },
            }}
          >
            <FaDatabase size={20} />
          </IconButton>
        </Box>
        {/* Közép és jobb ikonok közé helyezett AutoSend státusz */}
        <Box sx={{
          position: 'absolute',
          left: 'calc(75% - 16px)',
          top: '50%',
          transform: 'translateY(-50%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          px: 2,
          py: 1,
          borderRadius: 2,
          background: autoSend ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
          border: autoSend ? '1px solid rgba(34, 197, 94, 0.2)' : '1px solid rgba(239, 68, 68, 0.2)',
          transition: 'all 0.3s ease',
        }}>
          <Typography variant="caption" sx={{ mr: 1, fontWeight: 500, color: autoSend ? 'success.main' : 'error.main' }}>
            Auto
          </Typography>
          <Switch
    checked={autoSend || pendingAutoSend}
    onChange={handleAutoSendSwitch}
    color={autoSend ? "success" : "error"}
    inputProps={{ 'aria-label': 'Automatikus válaszküldés kapcsoló' }}
    sx={{
      '& .MuiSwitch-switchBase.Mui-checked': {
        color: '#22c55e',
      },
      '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
        backgroundColor: '#22c55e',
      },
      '& .MuiSwitch-switchBase': {
        color: '#ef4444',
      },
      '& .MuiSwitch-track': {
        backgroundColor: '#ef4444',
      },
    }}
  />
        </Box>
        {/* Jobbra igazított ikonok */}
        <Box sx={{ 
          display: 'flex', 
          gap: 0.5, 
          position: 'absolute', 
          right: 24,
          background: 'rgba(255, 255, 255, 0.05)',
          borderRadius: 2,
          p: 0.5,
          border: '1px solid rgba(255, 255, 255, 0.08)',
        }}>
          <IconButton 
            onClick={() => setActiveView('help')} 
            sx={{ 
              color: activeView === 'help' ? 'primary.main' : 'text.secondary',
              background: activeView === 'help' ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
              transition: 'all 0.2s ease',
              '&:hover': { 
                background: 'rgba(99, 102, 241, 0.2)',
                transform: 'scale(1.1)',
              },
            }}
          >
            <FaRegQuestionCircle size={20} />
          </IconButton>
          <IconButton 
            onClick={() => setActiveView('settings')} 
            sx={{ 
              color: activeView === 'settings' ? 'primary.main' : 'text.secondary',
              background: activeView === 'settings' ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
              transition: 'all 0.2s ease',
              '&:hover': { 
                background: 'rgba(99, 102, 241, 0.2)',
                transform: 'rotate(45deg)',
              },
            }}
          >
            <FaCog size={20} />
          </IconButton>
          <IconButton 
            onClick={handleLogoutClick} 
            sx={{ 
              color: 'text.secondary',
              transition: 'all 0.2s ease',
              '&:hover': { 
                color: 'warning.main',
                background: 'rgba(245, 158, 11, 0.15)',
                transform: 'translateX(2px)',
              },
            }}
          >
            <FaSignOutAlt size={20} />
          </IconButton>
          <IconButton 
            onClick={handleExitClick} 
            sx={{ 
              color: 'text.secondary',
              transition: 'all 0.2s ease',
              '&:hover': { 
                color: 'error.main',
                background: 'rgba(239, 68, 68, 0.15)',
              },
            }}
          >
            <FaPowerOff size={20} />
          </IconButton>
        </Box>
        {/*Balra igazított logó*/}
        <Box sx={{ 
          display: 'flex', 
          gap: 2, 
          alignItems: 'center', 
          position: 'absolute', 
          left: 20,
        }}>
          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            animation: 'fadeIn 0.5s ease forwards',
            '@keyframes fadeIn': {
              from: { opacity: 0, transform: 'translateX(-8px)' },
              to: { opacity: 1, transform: 'translateX(0)' },
            },
          }}>
            <img src="logo.png" alt="Ai Mail" style={{ height: 40, objectFit: 'contain' }} />
            {userEmail && (
              <Typography 
                variant="body1" 
                sx={{ 
                  ml: 1, 
                  color: 'text.primary', 
                  fontWeight: 600, 
                  fontSize: '1.2rem',
                  background: 'linear-gradient(135deg, currentColor 0%, rgba(99, 102, 241, 0.7) 100%)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                }}
              >
                {userEmail}
              </Typography>
            )}
          </Box>
        </Box>
      </Box>
      
      <Box sx={{ display: 'flex', height: '100vh' }}>
        {/* A tartalom lejjebb tolása a felső sáv miatt */}
        <Box
          sx={{
            position: 'fixed',
            top: 64,
            left: 0,
            height: 'calc(100vh - 64px)',
            zIndex: 1300,
            display: 'flex',
            flexDirection: 'row',
          }}
        >
          {/* Trigger sáv, csak ha nincs nyitva/pinned */}
          {!(isPinned || drawerOpen) && (
            <Box
              onMouseEnter={handleDrawerMouseEnter}
              sx={{
                width: 20,
                height: '100%',
                background: `linear-gradient(to right, ${theme.drawer?.triggerColor} 40%, ${theme.palette.background.default} 100%)`,
                opacity: 1,
                borderRight: `2px solid ${theme.palette.text.secondary}`,
                boxShadow: `2px 0 8px 0 ${theme.palette.text.secondary}`,
                borderTopRightRadius: 6,
                borderBottomRightRadius: 6,
                cursor: 'pointer',
                transition: 'background 0.2s',
              }}
            />
          )}
          {/* Drawer csak ha nyitva vagy pinned */}
          {(isPinned || drawerOpen) && (
            <Drawer
              variant={isPinned ? 'permanent' : 'persistent'}
              open={drawerOpen || isPinned}
              sx={{
                width: 200,
                flexShrink: 0,
                '& .MuiDrawer-paper': {
                  width: 200,
                  boxSizing: 'border-box',
                  backgroundColor: 'background.paper',
                  transition: 'left 0.2s',
                  left: drawerOpen || isPinned ? 0 : -200,
                  zIndex: 1300,
                  top: 64,
                  height: 'calc(100vh - 56px)',
                },
                position: 'fixed',
                zIndex: 1300,
              }}
              PaperProps={{
                sx: {
                  display: 'flex',
                  flexDirection: 'column',
                  height: '100vh',
                  backgroundColor: 'background.paper',
                  color: 'text.primary',
                  boxShadow: 4,
                  mt: 0,
                  pt: 0,
                  top: 56,
                  height: 'calc(100vh - 56px)',
                }
              }}
              onMouseLeave={handleDrawerMouseLeave}
            >
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', p: 1 }}>
                <Typography variant='caption' sx={{ mr: 9 }}>Verzió: 2.0.0</Typography>
                <IconButton onClick={handlePinClick} size="small" color={isPinned ? 'error' : 'default'}>
                  {isPinned ? (
                    <FaTimesCircle size={20} color="#d32f2f" />
                  ) : (
                    <FaThumbtack size={20} />
                  )}
                </IconButton>
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <List>
                  <ListItem disablePadding>
                    <ListItemButton selected={activeView === 'home'} onClick={() => setActiveView('home')}>
                      <ListItemText primary="Főoldal" />
                    </ListItemButton>
                  </ListItem>
                  <ListItem disablePadding>
                    <ListItemButton selected={activeView === 'mails'} onClick={() => setActiveView('mails')}>
                      <ListItemText primary="Beérkezett levelek" />
                    </ListItemButton>
                  </ListItem>
                  <ListItem disablePadding>
                    <ListItemButton selected={activeView === 'sentMails'} onClick={() => setActiveView('sentMails')}>
                      <ListItemText primary="Elküldött levelek" />
                    </ListItemButton>
                  </ListItem>
                  <ListItem disablePadding>
                    <ListItemButton selected={activeView === 'generatedMails'} onClick={() => setActiveView('generatedMails')}>
                      <ListItemText primary="Előkészített levelek" />
                    </ListItemButton>
                  </ListItem>
                  <ListItem disablePadding>
                    <ListItemButton selected={activeView === 'prompt'} onClick={() => setActiveView('prompt')}>
                      <ListItemText primary="Levél szerkezet" />
                    </ListItemButton>
                  </ListItem>
                  <ListItem disablePadding>
                    <ListItemButton selected={activeView === 'import'} onClick={() => setActiveView('import')}>
                      <ListItemText primary="AI adatbázis" />
                    </ListItemButton>
                  </ListItem>
                </List>
                <Box sx={{ flexGrow: 1 }} />
                <List>
                  <ListItem disablePadding>
                    <ListItemButton selected={activeView === 'help'} onClick={() => setActiveView('help')}>
                      <ListItemText primary="Súgó" />
                    </ListItemButton>
                  </ListItem>
                  <ListItem disablePadding>
                    <ListItemButton selected={activeView === 'settings'} onClick={() => setActiveView('settings')}>
                      <ListItemText primary="Beállítások" />
                    </ListItemButton>
                  </ListItem>
                  <ListItem disablePadding>
                    <ListItemButton onClick={handleLogoutClick}>
                      <ListItemText primary="Fiókváltás" />
                    </ListItemButton>
                  </ListItem>
                  <ListItem disablePadding>
                    <ListItemButton onClick={handleExitClick}>
                      <ListItemText primary="Kilépés" />
                    </ListItemButton>
                  </ListItem>
                </List>
              </Box>
            </Drawer>
          )}
        </Box>
        <Box component="main" sx={{ flexGrow: 1, pl: 4, pr: 4, pb: 4, pt: 1, ml: (drawerOpen || isPinned) ? '200px' : 0, transition: 'margin-left 0.2s', mt: '10px' }}>
          {renderView()}
        </Box>
        <ExitDialog
          open={exitDialogOpen}
          onClose={handleExitCancel}
          onConfirm={handleExitConfirm}
        />
        <LogoutDialog
          open={logoutDialogOpen}
          onClose={handleLogoutCancel}
          onConfirm={handleLogoutConfirm}
        />
        <Snackbar
          open={snackbarOpen}
          autoHideDuration={4000}
          onClose={() => setSnackbarOpen(false)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert onClose={() => setSnackbarOpen(false)} severity={snackbarSeverity} sx={{ width: '100%' }}>
            {snackbarMessage}
          </Alert>
        </Snackbar>
        <AutoSendConfirmDialog
  open={showAutoSendDialog}
  onClose={handleCancelAutoSend}
  onConfirm={handleConfirmAutoSend}
  startTime={startTime}
  endTime={endTime}
  onTimeChange={handleTimeChange}
  timedAutoSend={timedAutoSend}
  onTimedAutoSendChange={handleTimedAutoSendChange}
/>
      </Box>
    </ThemeProvider>
  );
};

// Initialize React only when DOM is ready
const initializeReact = () => {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    console.error('Root element not found!');
    return;
  }

  // Prevent double-initialization if the script gets evaluated twice
  if (window.__appInitialized) {
    console.warn('initializeReact called more than once; skipping second initialization.');
    return;
  }
  window.__appInitialized = true;

  // Clear any existing content
  while (rootElement.firstChild) {
    rootElement.removeChild(rootElement.firstChild);
  }

  const root = ReactDOM.createRoot(rootElement);

  // Cleanup on unmount
  const cleanup = () => {
    try {
      root.unmount();
    } catch (error) {
      console.error('Error during unmount:', error);
    }
  };

  window.addEventListener('beforeunload', cleanup);

  // Handle errors during render
  try {
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
    try {
      // send a single initialization log
      window.api?.sendToMain && window.api.sendToMain('log', 'App mounted.');
    } catch (e) {
      console.warn('Failed to send mount log', e);
    }
  } catch (error) {
    console.error('Error during render:', error);
    cleanup();
  }
};

// Ensure DOM is fully loaded before initializing
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeReact);
} else {
  initializeReact();
}

// NOTE: logging moved to initializeReact to avoid top-level React hooks in module scope.
