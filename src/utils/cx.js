/** Joins truthy class names: cx('base', isActive && 'active'). */
export const cx = (...classes) => classes.filter(Boolean).join(' ');
