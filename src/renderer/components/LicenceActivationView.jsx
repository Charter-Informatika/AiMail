import React, { useState } from "react";
import { useTheme } from "@mui/material/styles";
import { Box, TextField, Button, Typography } from "@mui/material";

const LicenceActivationView = ({}) => {
    const theme = useTheme();
    const [email, setEmail] = useState("");
    const [licence, setLicence] = useState("");
    const [touched, setTouched] = useState({ email: false, licence: false });
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(""); // új state

    const normalisedLicence = licence.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 16);

    const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    const isLicenceValid = normalisedLicence.length === 16;

    const canSubmit = isEmailValid && isLicenceValid && !submitting;

    const handleLicenceChange = (e) => {
        const raw = e.target.value;
        const cleaned = raw.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 16);
        // Optional: format into 4-4-4-4 groups
        const grouped = cleaned.match(/.{1,4}/g)?.join("-") || "";
        setLicence(grouped);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setTouched({ email: true, licence: true });
        setError("");
        if (!canSubmit) return;
        setSubmitting(true);
        try {
            const payload = { email: email.trim(), licenceKey: normalisedLicence };
            // IPC call to backend
            const res = await window.api.checkLicence(payload);
            if (res.success) {
                // Check if already activated
                const alreadyActivated = await window.api.isLicenceActivated(payload);
                if (alreadyActivated) {
                    setError("A licenc már aktiválva van az adatbázisban.");
                } else {
                    // Perform activation on the backend
                    const act = await window.api.activateLicence(payload);
                    if (act && act.success) {
                        // Successful activation: set license state via IPC
                        await window.api.setEmail(email.trim());
                        // Az email továbbítása az új IPC handlernek
                        await window.api.setActivationEmail(email.trim());
                        localStorage.setItem('isLicenced', 'true');
                        localStorage.setItem('licence', normalisedLicence);
                        window.location.reload(); // or navigate to the main app
                    } else {
                        setError(act?.error || 'Nem sikerült aktiválni a licencet.');
                    }
                }
            } else {
                setError(res.error || "Invalid license or email.");
            }
        } catch (err) {
            setError("Network or server error.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Box
            component="form"
            onSubmit={handleSubmit}
            noValidate
            sx={{
                width: 520,
                mx: "auto",
                mt: 16,
                display: "flex",
                flexDirection: "column",
                gap: 3,
                p: 5,
                background: 'linear-gradient(145deg, rgba(99, 102, 241, 0.08) 0%, rgba(30, 30, 40, 0.95) 100%)',
                borderRadius: 4,
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
                border: '1px solid rgba(99, 102, 241, 0.2)',
                animation: 'fadeIn 0.5s ease forwards',
                '@keyframes fadeIn': {
                    from: { opacity: 0, transform: 'translateY(20px)' },
                    to: { opacity: 1, transform: 'translateY(0)' },
                },
            }}
        >
            <Box sx={{ textAlign: 'center', mb: 2 }}>
                <Box sx={{
                    width: 70,
                    height: 70,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(168, 85, 247, 0.15) 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mx: 'auto',
                    mb: 2,
                }}>
                    <Typography sx={{ fontSize: 32 }}>🔐</Typography>
                </Box>
                <Typography 
                    variant="h5" 
                    fontWeight={700}
                    sx={{
                        background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                        backgroundClip: 'text',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                    }}
                >
                    Licenc aktiválás
                </Typography>
            </Box>

            <TextField
                label="Email cím"
                type="email"
                value={email}
                required
                autoComplete="email"
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => setTouched(t => ({ ...t, email: true }))}
                error={touched.email && !isEmailValid}
                helperText={
                    touched.email && !isEmailValid
                        ? "Érvényes email címet adjon meg."
                        : "Adja meg a vásárláskor használt email címet."
                }
                sx={{
                    '& .MuiOutlinedInput-root': {
                        borderRadius: 2,
                        background: 'rgba(0, 0, 0, 0.2)',
                    },
                }}
            />

            <TextField
                label="Licenckód (16 karakter)"
                value={licence}
                required
                inputProps={{ maxLength: 19, style: { letterSpacing: 2 } }} // 16 + 3 kötőjel
                onChange={handleLicenceChange}
                onBlur={() => setTouched(t => ({ ...t, licence: true }))}
                error={touched.licence && !isLicenceValid}
                helperText={
                    touched.licence && !isLicenceValid
                        ? "A licenckód pontosan 16 alfanumerikus karakter."
                        : "Pl.: ABCD-EF12-345G-HI67"
                }
                sx={{
                    '& .MuiOutlinedInput-root': {
                        borderRadius: 2,
                        background: 'rgba(0, 0, 0, 0.2)',
                    },
                }}
            />

            {error && (
                <Typography 
                    color="error" 
                    sx={{ 
                        mt: -1, 
                        mb: 1,
                        p: 1.5,
                        background: 'rgba(239, 68, 68, 0.1)',
                        borderRadius: 2,
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                    }}
                >
                    {error}
                </Typography>
            )}

            <Button
                type="submit"
                variant="contained"
                disabled={!canSubmit}
                sx={{
                    background: 'linear-gradient(135deg, #22c55e 0%, #10b981 100%)',
                    color: '#fff',
                    fontWeight: 600,
                    borderRadius: 2,
                    py: 1.5,
                    fontSize: '1rem',
                    boxShadow: '0 4px 15px rgba(34, 197, 94, 0.3)',
                    transition: 'all 0.2s ease',
                    '&:hover': { 
                        background: 'linear-gradient(135deg, #4ade80 0%, #34d399 100%)',
                        transform: 'translateY(-2px)',
                        boxShadow: '0 6px 20px rgba(34, 197, 94, 0.4)',
                    },
                    '&:disabled': {
                        background: 'rgba(100, 100, 100, 0.3)',
                    },
                }}
            >
                {submitting ? "Ellenőrzés..." : "Aktiválás"}
            </Button>
        </Box>
    );
};

export default LicenceActivationView;
