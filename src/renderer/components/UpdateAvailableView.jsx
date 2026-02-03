import React from "react";
import { Box, Typography, Button } from "@mui/material";

const UpdateAvailableView = ({ onClose }) => {

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
          from: { opacity: 0, transform: 'translateY(20px)' },
          to: { opacity: 1, transform: 'translateY(0)' },
        },
      }}
    >   
      <Box sx={{
        width: 80,
        height: 80,
        borderRadius: '50%',
        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(168, 85, 247, 0.1) 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        mb: 3,
        animation: 'float 3s ease-in-out infinite',
        '@keyframes float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      }}>
        <Typography sx={{ fontSize: 40 }}>🚀</Typography>
      </Box>
      <Typography 
        variant="h5" 
        gutterBottom
        sx={{
          fontWeight: 700,
          background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
          backgroundClip: 'text',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}
      >
        Frissítés elérhető!
      </Typography>
      <Typography variant="body1" sx={{ color: 'text.secondary', mb: 3 }}>
        Új frissítés érhető el az alkalmazáshoz. A letöltés folyamatban van.
      </Typography>
      <Button 
        variant="contained" 
        onClick={handleClose}
        sx={{
          background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
          color: '#fff',
          fontWeight: 600,
          borderRadius: 2,
          px: 4,
          boxShadow: '0 4px 15px rgba(99, 102, 241, 0.3)',
          transition: 'all 0.2s ease',
          '&:hover': { 
            background: 'linear-gradient(135deg, #818cf8 0%, #c084fc 100%)',
            transform: 'translateY(-2px)',
            boxShadow: '0 6px 20px rgba(99, 102, 241, 0.4)',
          },
        }}
      >
        OK
      </Button>
    </Box>
  );
};

export default UpdateAvailableView;