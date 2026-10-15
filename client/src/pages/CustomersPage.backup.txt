
import {
  Box,
  Button,
  Card,
  CardContent,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import { AddOutlined } from "@mui/icons-material";
import { Link, useSearchParams } from "react-router";

export default function CustomersPage() {
  const [params, setParams] = useSearchParams();
  const search = params.get("search") ?? "";

  // Save the search value in the URL.
  // Returning to this page will restore the search text.
  function updateSearch(value: string) {
    setParams(value ? { search: value } : {}, {
      replace: true,
    });
  }

  return (
    <Stack spacing={3}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
       
        gap={2}
       sx={{ justifyContent: "space-between" }}>
        <Box>
          <Typography variant="h5">Customers</Typography>
          <Typography color="text.secondary">
            Search customers by name or mobile number.
          </Typography>
        </Box>

        <Button
          component={Link}
          to="/customers/new"
          variant="contained"
          startIcon={<AddOutlined />}
        >
          Add Customer
        </Button>
      </Stack>

      <Card>
        <CardContent>
          <TextField
            fullWidth
            label="Search customer"
            placeholder="Enter name or phone number"
            value={search}
            onChange={(event) => updateSearch(event.target.value)}
            slotProps={{
              htmlInput: { maxLength: 150 },
            }}
          />

          <Typography
            color="text.secondary"
            sx={{ mt: 3 }}
          >
            Customer search results will appear here
            when we connect the backend API.
          </Typography>
        </CardContent>
      </Card>
    </Stack>
  );
}
