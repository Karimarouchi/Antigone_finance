import BubbleMenu from '@/components/BubbleMenu';

const NAV_ITEMS = [
  { label: 'Home', href: '/', ariaLabel: 'Home', rotation: -8, hoverStyles: { bgColor: '#e8621a', textColor: '#ffffff' } },
  { label: 'About', href: '/about', ariaLabel: 'About', rotation: 8, hoverStyles: { bgColor: '#10b981', textColor: '#ffffff' } },
  { label: 'Projects', href: '/projects', ariaLabel: 'Projects', rotation: 8, hoverStyles: { bgColor: '#f59e0b', textColor: '#ffffff' } },
  { label: 'Blog', href: '/blog', ariaLabel: 'Blog', rotation: -8, hoverStyles: { bgColor: '#3b82f6', textColor: '#ffffff' } },
  { label: 'Créateur de Factures', href: '/invoice', ariaLabel: 'Créateur de Factures', rotation: 8, hoverStyles: { bgColor: '#e8621a', textColor: '#ffffff' } },
];

export default function Banner({ center }: { center?: React.ReactNode }) {
  return (
    <div className="app-banner">
      <div className="logo">
        <div className="logo-icon">
          <img
          src="/icon.png"
          alt="Antigo"
          className="logo-img"
          style={{ cursor: 'pointer' }}
          onMouseEnter={(e) => (e.currentTarget.src = '/iconmv.png')}
          onMouseLeave={(e) => (e.currentTarget.src = '/icon.png')}
          onClick={() => (window.location.href = '/')}
        />
        </div>
      </div>

      {center && <div className="banner-center">{center}</div>}

      <div className="banner-right">
        <div className="banner-bubble-wrap">
          <BubbleMenu
            logo={null}
            onMenuClick={undefined}
            className="site-nav"
            style={undefined}
            items={NAV_ITEMS}
            useFixedPosition
            menuBg="var(--surface)"
            menuContentColor="var(--text)"
          />
        </div>
      </div>

    </div>
  );
}
