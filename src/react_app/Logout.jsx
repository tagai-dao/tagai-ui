import {usePrivy} from '@privy-io/react-auth';

export default function LogoutOAuth() {
    const { logout } = usePrivy();

    const handleLogin = async () => {
        try {
            await logout()
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <button onClick={handleLogin}>
            <img className="w-4 h-4 min-w-4" src={require('~@/assets/icons/icon-logout.svg')} alt="Logout" />
        </button>
    )
        ;
}