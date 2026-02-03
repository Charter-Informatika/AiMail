import { Box, Typography, Button } from "@mui/material";
import { FiWifiOff } from "react-icons/fi";
import React, { useState } from "react";
import CenteredLoading from './CenteredLoading';

const NoConnectionView = ({ onRetry }) => {
  const [loading, setLoading] = useState(false);

  const handleRetry = async () => {
    if (!onRetry) return;
    setLoading(true);
    try {
      await onRetry();
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <CenteredLoading size={48} text={'Ellenőrzés...'} />;

  return (
    <Box sx={{ 
      mt: 16, 
      textAlign: 'center', 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center',
      gap: 3,
      animation: 'fadeIn 0.5s ease forwards',
      '@keyframes fadeIn': {
        from: { opacity: 0, transform: 'translateY(20px)' },
        to: { opacity: 1, transform: 'translateY(0)' },
      },
    }}>
      <Box sx={{
        width: 120,
        height: 120,
        borderRadius: '50%',
        background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(239, 68, 68, 0.05) 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        animation: 'pulse 2s ease-in-out infinite',
        '@keyframes pulse': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(239, 68, 68, 0.3)' },
          '50%': { boxShadow: '0 0 0 20px rgba(239, 68, 68, 0)' },
        },
      }}>
        <FiWifiOff size={56} style={{ color: '#ef4444' }} />
      </Box>
      <Typography 
        variant="h4" 
        sx={{ 
          fontWeight: 700,
          background: 'linear-gradient(135deg, #ef4444 0%, #f97316 100%)',
          backgroundClip: 'text',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}
      >
        Nincs internetkapcsolat
      </Typography>
      <Typography variant="body1" sx={{ color: 'text.secondary', maxWidth: 400 }}>
        Kérjük, ellenőrizze a hálózatot, majd próbálja újra.
      </Typography>
      <Button
        variant="contained"
        onClick={handleRetry}
        disabled={loading}
        sx={{
          mt: 2,
          px: 4,
          py: 1.5,
          background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
          transition: 'all 0.3s ease',
          '&:hover': {
            background: 'linear-gradient(135deg, #f87171 0%, #ef4444 100%)',
            transform: 'translateY(-2px)',
            boxShadow: '0 8px 25px rgba(239, 68, 68, 0.35)',
          },
        }}
      >
        Próbáld újra
      </Button>
    </Box>
  );
}

export default NoConnectionView;