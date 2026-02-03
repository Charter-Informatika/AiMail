import React from "react";
import { Box, Typography, Button } from "@mui/material";

const UpdateReadyView = ({ onClose }) => {

  const handleRestart = () => {
    window.api.restartApp();
  }

  const handleClose = () => {
    if (onClose) {
      onClose();
    }
  };

  return (
    <Box
      sx={{
        p: 4,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "300px",
        textAlign: "center",
        mt: 16,
        animation: 'fadeIn 0.5s ease forwards',
        '@keyframes fadeIn': {
          from: { opacity: 0, transform: 'scale(0.95)' },
          to: { opacity: 1, transform: 'scale(1)' },
        },
      }}
    >
      <Box sx={{
        width: 80,
        height: 80,
        borderRadius: '50%',
        background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.2) 0%, rgba(16, 185, 129, 0.1) 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        mb: 3,
        animation: 'pulse 2s infinite',
        '@keyframes pulse': {
          '0%, 100%': { transform: 'scale(1)', boxShadow: '0 0 0 0 rgba(34, 197, 94, 0.4)' },
          '50%': { transform: 'scale(1.05)', boxShadow: '0 0 20px 10px rgba(34, 197, 94, 0.2)' },
        },
      }}>
        <Typography sx={{ fontSize: 40 }}>✓</Typography>
      </Box>
      <Typography 
        variant="h5" 
        gutterBottom
        sx={{
          fontWeight: 700,
          background: 'linear-gradient(135deg, #22c55e 0%, #10b981 100%)',
          backgroundClip: 'text',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}
      >
        Frissítés letöltve!
      </Typography>
      <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
        <Button 
          variant="outlined" 
          onClick={handleClose}
          sx={{
            borderColor: 'rgba(255, 255, 255, 0.3)',
            color: 'text.primary',
            borderRadius: 2,
            px: 3,
            transition: 'all 0.2s ease',
            '&:hover': {
              borderColor: 'rgba(255, 255, 255, 0.5)',
              background: 'rgba(255, 255, 255, 0.05)',
            },
          }}
        >
          Később
        </Button>
        <Button 
          variant="contained" 
          onClick={handleRestart}
          sx={{
            background: 'linear-gradient(135deg, #22c55e 0%, #10b981 100%)',
            color: '#fff',
            fontWeight: 600,
            borderRadius: 2,
            px: 3,
            boxShadow: '0 4px 15px rgba(34, 197, 94, 0.3)',
            transition: 'all 0.2s ease',
            '&:hover': { 
              background: 'linear-gradient(135deg, #4ade80 0%, #34d399 100%)',
              transform: 'translateY(-2px)',
              boxShadow: '0 6px 20px rgba(34, 197, 94, 0.4)',
            },
          }}
        >
          Újraindítás
        </Button>
      </Box>
    </Box>
  );
};

export default UpdateReadyView;