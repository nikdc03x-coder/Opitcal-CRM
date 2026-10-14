
import { useState } from "react";
import {
  AppBar,
  Box,
  CssBaseline,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  useMediaQuery,
  useTheme,
  Chip,
} from "@mui/material";

import {
  DashboardOutlined,
  PeopleOutline,
  PersonAddAltOutlined,
  Menu as MenuIcon,
  StorefrontOutlined,
} from "@mui/icons-material";

import {
  NavLink,
  Outlet,
  useLocation,
} from "react-router";

const drawerWidth = 250;

// All sidebar links are defined here.
// React Router automatically highlights the active page.
const navigation = [
  {
    label: "Dashboard",
    path: "/dashboard",
    icon: <DashboardOutlined />,
  },
  {
    label: "Customers",
    path: "/customers",
    icon: <PeopleOutline />,
  },
  {
    label: "Add Customer",
    path: "/customers/new",
    icon: <PersonAddAltOutlined />,
  },
];

export default function AppLayout() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  // Determine the page title using its current route.
  const pageTitle =
    location.pathname === "/dashboard"
      ? "Dashboard"
      : location.pathname === "/customers"
        ? "Customers"
        : location.pathname === "/customers/new"
          ? "Add Customer"
          : "Customer Details";

  const sidebar = (
    <Box sx={{ height: "100%", bgcolor: "background.paper" }}>
      <Toolbar sx={{ gap: 1.5 }}>
        <StorefrontOutlined color="primary" />
        <Typography variant="h6">Optical CRM</Typography>
      </Toolbar>

      <Divider />

      <Typography
        variant="overline"
        color="text.secondary"
        sx={{ px: 3, pt: 3, display: "block" }}
      >
        Workspace
      </Typography>

      <List sx={{ px: 1.5 }}>
        {navigation.map((item) => (
          <ListItemButton
            key={item.path}
            component={NavLink}
            to={item.path}
            end={item.path === "/customers"}
            onClick={() => setMobileOpen(false)}
            sx={{
              borderRadius: 2,
              mb: 0.5,
              "&.active": {
                bgcolor: "primary.main",
                color: "white",
                "& .MuiListItemIcon-root": {
                  color: "white",
                },
              },
            }}
          >
            <ListItemIcon sx={{ minWidth: 40 }}>
              {item.icon}
            </ListItemIcon>
            <ListItemText primary={item.label} />
          </ListItemButton>
        ))}
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <CssBaseline />

      {/* The sidebar becomes a temporary drawer on mobile. */}
      <Drawer
        variant={isMobile ? "temporary" : "permanent"}
        open={isMobile ? mobileOpen : true}
        onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          width: isMobile ? 0 : drawerWidth,
          flexShrink: 0,
          "& .MuiDrawer-paper": {
            width: drawerWidth,
            boxSizing: "border-box",
          },
        }}
      >
        {sidebar}
      </Drawer>

      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <AppBar
          position="sticky"
          color="inherit"
          elevation={0}
          sx={{ borderBottom: "1px solid #E7EBF2" }}
        >
          <Toolbar sx={{ gap: 2 }}>
            {isMobile && (
              <IconButton
                aria-label="Open navigation"
                onClick={() => setMobileOpen(true)}
              >
                <MenuIcon />
              </IconButton>
            )}

            <Typography variant="h6" sx={{ flexGrow: 1 }}>
              {pageTitle}
            </Typography>

            <Chip
              size="small"
              color="primary"
              variant="outlined"
              label="Demo Shop"
            />
          </Toolbar>
        </AppBar>

        {/* The selected route is rendered here. */}
        <Box
          component="main"
          sx={{
            maxWidth: 1400,
            mx: "auto",
            p: { xs: 2, sm: 3, lg: 4 },
          }}
        >
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
