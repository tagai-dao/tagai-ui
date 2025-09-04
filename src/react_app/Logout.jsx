import {usePrivy} from '@privy-io/react-auth';

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
            <img className="w-4 h-4 min-w-4" src={require('~@/assets/icons/icon-logout.svg')} alt="Logout" />
        </button>
    )
        ;
}