
import {
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Grid,
  Stack,
  Typography,
} from "@mui/material";


import PersonAddAltOutlined from "@mui/icons-material/PersonAddAltOutlined";

import PeopleOutlined from "@mui/icons-material/PeopleOutlined";

import ArrowForwardOutlined from "@mui/icons-material/ArrowForwardOutlined";


import { Link } from "react-router";

// The dashboard uses navigation cards.
// Live customer statistics will be added only after
// the PostgreSQL APIs have passed testing.
const actions = [
  {
    title: "Add Customer",
    description: "Register a customer and optical prescription.",
    path: "/customers/new",
    icon: <PersonAddAltOutlined fontSize="large" color="primary" />,
  },
  {
    title: "Find Customer",
    description: "Search customer records by name or mobile number.",
    path: "/customers",
    
icon: <PeopleOutlined fontSize="large" color="primary" />,

  },
];

export default function DashboardPage() {
  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          Welcome to Optical CRM
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 1 }}>
          Manage customer records and optical prescriptions
          from one simple workspace.
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {actions.map((action) => (
          <Grid key={action.path} size={{ xs: 12, md: 6 }}>
            <Card sx={{ height: "100%" }}>
              <CardActionArea
                component={Link}
                to={action.path}
                sx={{ height: "100%" }}
              >
                <CardContent sx={{ p: 3 }}>
                  {action.icon}

                  <Typography variant="h6" sx={{ mt: 2 }}>
                    {action.title}
                  </Typography>

                  <Typography color="text.secondary" sx={{ my: 1 }}>
                    {action.description}
                  </Typography>

                  <Button
                    component="span"
                    endIcon={<ArrowForwardOutlined />}
                    sx={{ mt: 2 }}
                  >
                    Open
                  </Button>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Stack>
  );
}
