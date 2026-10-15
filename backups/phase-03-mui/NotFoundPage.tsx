
import {
  Box,
  Button,
  Stack,
  Typography,
} from "@mui/material";

import { HomeOutlined } from "@mui/icons-material";
import { Link } from "react-router";

export default function NotFoundPage() {
  return (
    <Box sx={{ py: 8, textAlign: "center" }}>
      <Stack spacing={2} alignItems="center">
        <Typography variant="h2" fontWeight={700}>
          404
        </Typography>

        <Typography variant="h5">
          Page Not Found
        </Typography>

        <Typography color="text.secondary">
          The page you requested does not exist.
        </Typography>

        <Button
          component={Link}
          to="/dashboard"
          variant="contained"
          startIcon={<HomeOutlined />}
        >
          Return to Dashboard
        </Button>
      </Stack>
    </Box>
  );
}
