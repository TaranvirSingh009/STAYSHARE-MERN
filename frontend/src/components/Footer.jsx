import { Link } from "react-router-dom";

export default function Footer() {
  return <footer className="site-footer"><Link className="footer-brand" to="/">stayshare</Link><span>Find a stay. Feel at home.</span><nav aria-label="Information"><Link to="/help-support">Help & support</Link><Link to="/about">About</Link><Link to="/user-agreement">User agreement</Link></nav><small>© {new Date().getFullYear()} StayShare</small></footer>;
}
