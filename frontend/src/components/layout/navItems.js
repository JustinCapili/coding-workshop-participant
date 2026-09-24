import DashboardIcon from '@mui/icons-material/Dashboard'
import HistoryIcon from '@mui/icons-material/History'
import MenuBookIcon from '@mui/icons-material/MenuBook'
import Inventory2Icon from '@mui/icons-material/Inventory2'
import PersonAddIcon from '@mui/icons-material/PersonAdd'
import FactCheckIcon from '@mui/icons-material/FactCheck'
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings'
import { isDefaultAdmin } from '../../domain/accounts'
import { Role, hasRole } from '../../domain/roles'

/** Sidebar sections, gated by the minimum role that can see them. */
const SECTIONS = [
  {
    heading: null,
    role: Role.EMPLOYEE,
    items: [
      { label: 'Dashboard', to: '/dashboard', icon: DashboardIcon },
      { label: 'Common Cases', to: '/common-cases', icon: MenuBookIcon },
    ],
  },
  {
    heading: 'Engineer',
    role: Role.ENGINEER,
    items: [
      { label: 'Previous Reports', to: '/reports/previous', icon: HistoryIcon },
      { label: 'Request Inventory', to: '/inventory/request', icon: Inventory2Icon },
    ],
  },
  {
    heading: 'Team',
    role: Role.FACULTY_ADMIN,
    items: [
      { label: 'Create Engineer', to: '/team/engineers/new', icon: PersonAddIcon },
      { label: 'Current Open Cases', to: '/team/open-cases', icon: FactCheckIcon },
      // Only admin@acme.inc can make faculty admins, so only they see the page.
      { label: 'Faculty Admins', to: '/team/admins', icon: AdminPanelSettingsIcon, visible: isDefaultAdmin },
    ],
  },
]

/** The sections `user` may see, each with only the items whose `visible(user)` holds, if it has one. */
export function sectionsFor(user) {
  return SECTIONS.filter((section) => hasRole(user, section.role)).map((section) => ({
    ...section,
    items: section.items.filter((item) => !item.visible || item.visible(user)),
  }))
}
