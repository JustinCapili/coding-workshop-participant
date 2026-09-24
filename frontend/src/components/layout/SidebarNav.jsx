import { NavLink, useLocation } from 'react-router-dom'
import Box from '@mui/material/Box'
import Divider from '@mui/material/Divider'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import ListSubheader from '@mui/material/ListSubheader'
import { sectionsFor } from './navItems'

export default function SidebarNav({ user, onNavigate }) {
  const { pathname } = useLocation()
  const sections = sectionsFor(user)

  return (
    <Box component="nav" aria-label="Main navigation" sx={{ py: 1 }}>
      {sections.map((section, index) => (
        <Box key={section.heading ?? 'root'}>
          {index > 0 && <Divider sx={{ my: 1 }} />}
          <List
            dense
            subheader={
              section.heading ? (
                <ListSubheader disableSticky sx={{ lineHeight: '32px', textTransform: 'uppercase', fontSize: 11, letterSpacing: 0.8 }}>
                  {section.heading}
                </ListSubheader>
              ) : undefined
            }
          >
            {section.items.map(({ label, to, icon: Icon }) => {
              const selected = pathname === to || (to !== '/dashboard' && pathname.startsWith(`${to}/`))
              return (
                <ListItemButton
                  key={to}
                  component={NavLink}
                  to={to}
                  selected={selected}
                  onClick={onNavigate}
                  sx={{ mx: 1, borderRadius: 1.5, my:1 }}
                >
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <Icon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText primary={label} />
                </ListItemButton>
              )
            })}
          </List>
        </Box>
      ))}
    </Box>
  )
}
