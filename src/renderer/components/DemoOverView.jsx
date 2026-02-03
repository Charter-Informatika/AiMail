import React from "react";
import { Box, Typography, Button, useTheme } from '@mui/material';

const DemoOverView = () => {
  const theme = useTheme();

  const handleExit = () => {
    window.api.openExternal('https://okosmail.hu');
    setTimeout(() => {
      window.api.exitApp();
    }, 500);
  };

  return (
    <Box
      sx={{
        position: 'relative',
        minHeight: '100vh',
        bgcolor: theme.palette.background.default,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        animation: 'fadeIn 0.5s ease forwards',
        '@keyframes fadeIn': {
          from: { opacity: 0 },
          to: { opacity: 1 },
        },
      }}
    >
      <Box sx={{
        width: 100,
        height: 100,
        borderRadius: '50%',
        background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.2) 0%, rgba(239, 68, 68, 0.15) 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        mb: 4,
        animation: 'pulse 2s infinite',
        '@keyframes pulse': {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.05)' },
        },
      }}>
        <Typography sx={{ fontSize: 50 }}>⏰</Typography>
      </Box>
      <Typography
        variant="h4"
        sx={{
          color: theme.palette.text.primary,
          mb: 3,
          fontWeight: 700,
          letterSpacing: 1,
          background: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
          backgroundClip: 'text',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}
      >
        Véget ért a próba időszak!
      </Typography>
      <Typography
        variant="h6"
        sx={{
          color: 'rgba(255, 255, 255, 0.8)',
          mb: 4,
          px: 4,
          maxWidth: 600,
          textAlign: 'center',
          fontWeight: 500,
          lineHeight: 1.6,
        }}
      >
        Köszönjük, hogy kipróbáltad az alkalmazást! A további használathoz kérjük, fizessen elő az Ön számára legmegfelelőbb csomagra.
      </Typography>
      <Button 
        variant="contained" 
        size="large" 
        onClick={handleExit} 
        sx={{ 
          mt: 2,
          background: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
          color: '#fff',
          fontWeight: 600,
          borderRadius: 3,
          px: 5,
          py: 1.5,
          fontSize: '1.1rem',
          boxShadow: '0 4px 20px rgba(245, 158, 11, 0.3)',
          transition: 'all 0.2s ease',
          '&:hover': { 
            background: 'linear-gradient(135deg, #fbbf24 0%, #f87171 100%)',
            transform: 'translateY(-3px)',
            boxShadow: '0 8px 30px rgba(245, 158, 11, 0.4)',
          },
        }}
      >
        Ok
      </Button>
    </Box>
  );
};

export default DemoOverView;