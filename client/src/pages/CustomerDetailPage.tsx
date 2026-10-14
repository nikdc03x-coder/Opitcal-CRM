
import {
  Alert,
  Button,
  Card,
  CardContent,
  Stack,
  Typography,
} from "@mui/material";

import { ArrowBackOutlined } from "@mui/icons-material";
import { Link, useParams } from "react-router";

export default function CustomerDetailPage() {
  const { id } = useParams();

  return (
    <Stack spacing={3}>
      <Button
        component={Link}
        to="/customers"
        startIcon={<ArrowBackOutlined />}
        sx={{ alignSelf: "flex-start" }}
      >
        Back to Customers
      </Button>

      <Typography variant="h5">
        Customer Details
      </Typography>

      <Card>
        <CardContent>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            Selected customer ID: {id}
          </Typography>

          <Alert severity="info">
            The complete customer record will load here
            after we connect the PostgreSQL API.
          </Alert>
        </CardContent>
      </Card>
    </Stack>
  );
}
