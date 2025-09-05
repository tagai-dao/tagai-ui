import {usePrivy} from '@privy-io/react-auth';
import logoutIcon from '@/assets/icons/icon-logout.svg';

export default function LogoutOAuth() {
    const { logout } = usePrivy();

    const handleLogin = async () => {
        try {
            console.log('start log out')
            await logout()
            console.log('log out success')
        } catch (err) {
            console.error(err);
            console.log('log out error')
        }
    };

    return (
        <button onClick={handleLogin}>
            <img className="w-4 h-4 min-w-4" src={logoutIcon} alt="Logout" />
        </button>
    );
}