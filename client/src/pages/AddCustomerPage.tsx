
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Stack,
  Typography,
} from "@mui/material";

import { ArrowBackOutlined } from "@mui/icons-material";
import { Link } from "react-router";

export default function AddCustomerPage() {
  return (
    <Stack spacing={3}>
      <Box>
        <Button
          component={Link}
          to="/customers"
          startIcon={<ArrowBackOutlined />}
        >
          Back to Customers
        </Button>

        <Typography variant="h5" sx={{ mt: 2 }}>
          Add New Customer
        </Typography>

        <Typography color="text.secondary">
          Customer details, optical prescription and pricing.
        </Typography>
      </Box>

      <Card>
        <CardContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            The registration form will be added in
            the next frontend development step.
          </Alert>

          <Typography color="text.secondary">
            Planned sections: Personal Information,
            Prescription, Frame & Lens Details,
            Pricing and Private Notes.
          </Typography>
        </CardContent>
      </Card>
    </Stack>
  );
}
