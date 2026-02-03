import React from "react";
import { Box, Typography, Button } from "@mui/material";
import CenteredLoading from './CenteredLoading';

const UpdateView = () => {
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
        Frissítések letöltése folyamatban...
      </Typography>
      <Typography variant="body1" sx={{ color: 'text.secondary', mb: 3 }}>
        Ez eltarthat néhány másodpercig. Kérjük, NE zárd be az alkalmazást!
      </Typography>
      <CenteredLoading size={60} />
    </Box>
  );
};

export default UpdateView;