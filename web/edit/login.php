<?php
/**
 * Login Page for Edit Tool
 */

require_once __DIR__ . '/../../config/edit-config.php';
require_once __DIR__ . '/auth.php';

// If already authenticated, redirect to main page
if (isAuthenticated()) {
    header('Location: index.php');
    exit;
}

$error = '';

// Handle login form submission
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    
    // Check if IP is locked out
    $lockoutStatus = isIpLockedOut($ip);
    if ($lockoutStatus['locked']) {
        $minutes = ceil($lockoutStatus['remaining_time'] / 60);
        $error = "Too many failed login attempts. Please try again in {$minutes} minute(s).";
        logAccess('LOGIN_BLOCKED - IP locked out', false);
    } else {
        $username = $_POST['username'] ?? '';
        $password = $_POST['password'] ?? '';
        
        // Verify credentials
        if ($username === EDIT_USERNAME && password_verify($password, EDIT_PASSWORD_HASH)) {
            // Regenerate session ID to prevent session fixation
            session_regenerate_id(true);
            
            // Set session variables
            $_SESSION['authenticated'] = true;
            $_SESSION['username'] = $username;
            $_SESSION['last_activity'] = time();
            $_SESSION['login_time'] = time();
            
            // Generate CSRF token
            generateCsrfToken();
            
            // Clear failed login attempts for this IP
            clearFailedLoginAttempts($ip);
            
            // Log successful login
            logAccess('LOGIN', true);
            
            // Redirect to main page
            header('Location: index.php');
            exit;
        } else {
            // Record failed attempt
            recordFailedLoginAttempt($ip);
            
            $error = 'Invalid username or password';
            logAccess('LOGIN_FAILED', false);
        }
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login - ODM Editor</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: #666;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .login-container {
            background: white;
            border-radius: 8px;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
            padding: 40px;
            width: 100%;
            max-width: 400px;
        }
        
        h1 {
            font-size: 24px;
            margin-bottom: 10px;
            color: #333;
        }
        
        .subtitle {
            color: #666;
            margin-bottom: 30px;
            font-size: 14px;
        }
        
        .form-group {
            margin-bottom: 20px;
        }
        
        label {
            display: block;
            margin-bottom: 5px;
            color: #333;
            font-weight: 500;
            font-size: 14px;
        }
        
        input[type="text"],
        input[type="password"] {
            width: 100%;
            padding: 12px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 14px;
            transition: border-color 0.3s;
        }
        
        input[type="text"]:focus,
        input[type="password"]:focus {
            outline: none;
            border-color: #667eea;
        }
        
        button {
            width: 100%;
            padding: 12px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 4px;
            font-size: 16px;
            font-weight: 500;
            cursor: pointer;
            transition: transform 0.2s, box-shadow 0.2s;
        }
        
        button:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        }
        
        button:active {
            transform: translateY(0);
        }
        
        .error {
            background: #fee;
            color: #c33;
            padding: 12px;
            border-radius: 4px;
            margin-bottom: 20px;
            font-size: 14px;
            border: 1px solid #fcc;
        }
        
        .info {
            margin-top: 20px;
            padding: 12px;
            background: #f0f0f0;
            border-radius: 4px;
            font-size: 12px;
            color: #666;
        }
    </style>
</head>
<body>
    <div class="login-container">
        <h1>ODM Editor</h1>
        
        <?php if ($error): ?>
            <div class="error"><?php echo htmlspecialchars($error); ?></div>
        <?php endif; ?>
        
        <form method="POST" action="">
            <div class="form-group">
                <label for="username">Username</label>
                <input type="text" id="username" name="username" required autofocus>
            </div>
            
            <div class="form-group">
                <label for="password">Password</label>
                <input type="password" id="password" name="password" required>
            </div>
            
            <button type="submit">Login</button>
        </form>
    </div>
</body>
</html>

