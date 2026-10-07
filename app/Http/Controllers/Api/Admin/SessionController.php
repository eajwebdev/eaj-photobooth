<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\Response;

class SessionController extends Controller
{
    /**
     * Lets the PIN pad confirm a PIN; the pin middleware has already checked it.
     */
    public function store(): Response
    {
        return response()->noContent();
    }
}
